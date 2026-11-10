import { constants } from 'node:fs';
import { mkdir, open, rename, unlink, lstat } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';
import { validateContent } from '../shared/content-schema.mjs';

export class HttpError extends Error {
  constructor(status, error, message, errors) {
    super(message);
    Object.assign(this, { status, error, errors });
  }
}

export async function readPrivateFile(file) {
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    if (!(await handle.stat()).isFile()) throw new Error('Private storage must contain ordinary files.');
    return await handle.readFile('utf8');
  } finally { await handle.close(); }
}

export async function atomicPrivateWrite(file, value) {
  try {
    if (!(await lstat(file)).isFile()) throw new Error('Refusing to replace non-file storage.');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const temporary = `${file}.${randomBytes(12).toString('hex')}.tmp`;
  let handle;
  try {
    handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    await handle.writeFile(value, 'utf8');
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporary, file);
  } finally {
    if (handle) await handle.close();
    await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}

export function contentRevision(content) {
  return createHash('sha256').update(JSON.stringify(content)).digest('hex');
}

function assertContent(content) {
  const errors = validateContent(content);
  if (errors.length) throw new HttpError(422, 'invalid_content', 'Revisa el contenido indicado.', errors);
}

const applicationFields = ['id', 'type', 'createdAt', 'status', 'notes', 'fullName', 'email', 'phone', 'city', 'area', 'message', 'company', 'need'];
function assertApplications(applications) {
  if (!Array.isArray(applications)) throw new Error('Invalid private applications storage.');
  const ids = new Set();
  for (const application of applications) {
    if (!application || typeof application !== 'object' || Object.keys(application).some(key => !applicationFields.includes(key)) ||
        applicationFields.some(key => typeof application[key] !== 'string') ||
        !/^[a-zA-Z0-9-]{1,100}$/.test(application.id) || ids.has(application.id) ||
        !['candidate', 'employer'].includes(application.type) || !['new', 'contacted', 'closed'].includes(application.status) ||
        !Number.isFinite(Date.parse(application.createdAt)) || application.notes.length > 4000) {
      throw new Error('Invalid private application record.');
    }
    ids.add(application.id);
  }
}

export async function createStore({ dataDir, initialContent }) {
  assertContent(initialContent);
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  if (!(await lstat(dataDir)).isDirectory()) throw new Error('Private data directory must not be a symlink.');
  const contentFile = path.join(dataDir, 'content.json');
  const applicationsFile = path.join(dataDir, 'applications.json');
  for (const [file, initial] of [[contentFile, initialContent], [applicationsFile, []]]) {
    try { await readPrivateFile(file); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await atomicPrivateWrite(file, JSON.stringify(initial, null, 2) + '\n');
    }
  }

  let queued = Promise.resolve();
  function serialize(operation) {
    const result = queued.then(operation);
    queued = result.catch(() => {});
    return result;
  }
  async function getContent() {
    const content = JSON.parse(await readPrivateFile(contentFile));
    assertContent(content);
    return { content, revision: contentRevision(content) };
  }
  async function getApplications() {
    const applications = JSON.parse(await readPrivateFile(applicationsFile));
    assertApplications(applications);
    return applications;
  }
  await getContent();
  await getApplications();

  return {
    getContent,
    getApplications,
    setContent(content, revision) {
      return serialize(async () => {
        assertContent(content);
        const current = await getContent();
        if (revision !== current.revision) throw new HttpError(409, 'revision_conflict', 'El contenido ha cambiado. Recarga la versión actual antes de guardar.');
        await atomicPrivateWrite(contentFile, JSON.stringify(content, null, 2) + '\n');
        return { content, revision: contentRevision(content) };
      });
    },
    updateApplication(id, change) {
      return serialize(async () => {
        if (!change || typeof change !== 'object' || Array.isArray(change) ||
            Object.keys(change).some(key => !['status', 'notes'].includes(key)) ||
            !['new', 'contacted', 'closed'].includes(change.status) || typeof change.notes !== 'string' || change.notes.length > 4000) {
          throw new HttpError(422, 'invalid_application_update', 'Indica un estado válido y notas de hasta 4000 caracteres.');
        }
        const applications = await getApplications();
        const application = applications.find(item => item.id === id);
        if (!application) throw new HttpError(404, 'application_not_found', 'No se ha encontrado la solicitud.');
        Object.assign(application, { status: change.status, notes: change.notes });
        await atomicPrivateWrite(applicationsFile, JSON.stringify(applications, null, 2) + '\n');
        return { application };
      });
    },
  };
}
