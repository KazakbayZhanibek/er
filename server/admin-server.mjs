import http from 'node:http';
import { constants } from 'node:fs';
import { lstat, open, readFile, mkdir, realpath } from 'node:fs/promises';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore, HttpError, readPrivateFile, atomicPrivateWrite } from './store.mjs';

const scrypt = promisify(scryptCallback);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sessionLife = 8 * 60 * 60 * 1000;
const bodyLimit = 64 * 1024;
const loopbackHosts = new Set(['127.0.0.1', 'localhost', '::1']);
const contentTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp4': 'video/mp4', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

function json(response, status, value, extraHeaders = {}) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders });
  response.end(JSON.stringify(value));
}

async function readJson(request) {
  if (!/^application\/json(?:\s*;.*)?$/i.test(request.headers['content-type'] || '')) {
    throw new HttpError(415, 'json_required', 'Envía los datos en formato JSON.');
  }
  if (request.headers['content-encoding'] && request.headers['content-encoding'] !== 'identity') {
    throw new HttpError(415, 'encoding_not_supported', 'La codificación de la solicitud no es compatible.');
  }
  if (Number(request.headers['content-length']) > bodyLimit) throw new HttpError(413, 'body_too_large', 'La solicitud es demasiado grande.');
  let length = 0;
  const parts = [];
  for await (const part of request) {
    length += part.length;
    if (length > bodyLimit) throw new HttpError(413, 'body_too_large', 'La solicitud es demasiado grande.');
    parts.push(part);
  }
  try {
    const value = JSON.parse(Buffer.concat(parts).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new HttpError(400, 'invalid_json', 'El JSON de la solicitud no es válido.'); }
}

function sessionHash(value) { return createHash('sha256').update(value).digest('hex'); }
function isInside(directory, target) {
  const relative = path.relative(directory, target);
  return !relative || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

function requestPath(request) {
  const raw = (request.url || '/').split('?')[0];
  let decoded;
  try { decoded = decodeURIComponent(raw); }
  catch { throw new HttpError(400, 'invalid_path', 'Ruta no válida.'); }
  if (!decoded.startsWith('/') || /[\\\0%]/.test(decoded) || decoded.split('/').some(part => part.startsWith('.'))) {
    throw new HttpError(404, 'not_found', 'No encontrado.');
  }
  return decoded;
}

async function serveStatic(request, response, directory, relativePath) {
  try { if (!(await lstat(directory)).isDirectory()) return false; }
  catch (error) { if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return false; throw error; }
  const parts = relativePath.split('/').filter(Boolean);
  let target = directory;
  for (const part of parts) {
    target = path.join(target, part);
    try { if ((await lstat(target)).isSymbolicLink()) return false; }
    catch (error) { if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return false; throw error; }
  }
  let file;
  try { file = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW); }
  catch (error) { if (['ENOENT', 'ENOTDIR', 'ELOOP'].includes(error.code)) return false; throw error; }
  const stat = await file.stat();
  if (!stat.isFile()) { await file.close(); return false; }
  let start = 0;
  let end = stat.size - 1;
  let status = 200;
  if (request.headers.range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
    if (!match || (!match[1] && !match[2])) {
      await file.close(); response.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }); response.end(); return true;
    }
    if (!match[1]) start = Math.max(0, stat.size - Number(match[2]));
    else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= stat.size) {
      await file.close(); response.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }); response.end(); return true;
    }
    status = 206;
  }
  const headers = {
    'Content-Type': contentTypes[path.extname(target)] || 'application/octet-stream',
    'Content-Length': Math.max(0, end - start + 1),
    'Accept-Ranges': 'bytes',
    'Cache-Control': path.extname(target) === '.html' ? 'no-store' : 'public, max-age=3600',
  };
  if (status === 206) headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
  response.writeHead(status, headers);
  if (request.method === 'HEAD' || stat.size === 0) { await file.close(); response.end(); return true; }
  const stream = file.createReadStream({ start, end, autoClose: true });
  stream.on('error', () => response.destroy());
  response.on('close', () => stream.destroy());
  stream.pipe(response);
  return true;
}

export async function createAdminServer(options = {}) {
  const rootDir = path.resolve(options.rootDir || projectRoot);
  const dataDir = path.resolve(options.dataDir || path.join(rootDir, '.kompas-data'));
  const clientDir = path.resolve(options.clientDir || path.join(rootDir, 'dist/client'));
  const adminDir = path.resolve(options.adminDir || path.join(rootDir, 'dist/admin'));
  const privateRoot = path.join(rootDir, '.kompas-data');
  if (isInside(rootDir, dataDir) && !isInside(privateRoot, dataDir)) {
    throw new Error('Private storage must be in .kompas-data or outside the project sources.');
  }
  for (const directory of [clientDir, adminDir]) {
    if (isInside(directory, dataDir)) {
      throw new Error('Private storage must be outside every static directory.');
    }
  }
  const host = options.host || '127.0.0.1';
  const local = loopbackHosts.has(host);
  let publicOrigin;
  if (options.origin) {
    const parsed = new URL(options.origin);
    if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash || !['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('KOMPAS_PUBLIC_ORIGIN must be a plain HTTP(S) origin.');
    }
    publicOrigin = parsed.origin;
  }
  if (!local && (!publicOrigin || !publicOrigin.startsWith('https://'))) {
    throw new Error('A non-loopback server requires an explicit HTTPS KOMPAS_PUBLIC_ORIGIN.');
  }
  if (!local && !options.password) throw new Error('A non-loopback server requires KOMPAS_ADMIN_PASSWORD.');
  const secureCookies = publicOrigin?.startsWith('https://') || false;
  const initialContent = options.initialContent || JSON.parse(await readFile(path.join(rootDir, 'src/content/site.json'), 'utf8'));
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  const actualRoot = await realpath(rootDir);
  const actualData = await realpath(dataDir);
  if (isInside(actualRoot, actualData) && !isInside(path.join(actualRoot, '.kompas-data'), actualData)) {
    throw new Error('Private storage must remain outside project sources, including through symlinks.');
  }
  const store = await createStore({ dataDir, initialContent });
  let password = options.password;
  let passwordFile;
  if (!password) {
    passwordFile = path.join(dataDir, 'local-admin-password');
    try { password = (await readPrivateFile(passwordFile)).trim(); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      password = randomBytes(32).toString('base64url');
      await atomicPrivateWrite(passwordFile, `${password}\n`);
    }
  }
  if (typeof password !== 'string' || password.length < 16 || password.length > 1024) {
    throw new Error('The administrator password must contain between 16 and 1024 characters.');
  }
  const salt = randomBytes(32);
  const passwordHash = await scrypt(password, salt, 64);
  password = undefined;
  const sessions = new Map();
  const loginAttempts = new Map();
  const cookieName = secureCookies ? '__Host-kompas_session' : 'kompas_session';
  const now = options.now || Date.now;
  function cookie(value, maxAge) {
    return `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secureCookies ? '; Secure' : ''}`;
  }
  function authenticated(request) {
    const match = (request.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(`${cookieName}=`));
    const token = match?.slice(cookieName.length + 1);
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const hash = sessionHash(token);
    const expiration = sessions.get(hash);
    if (!expiration || expiration <= now()) { sessions.delete(hash); return null; }
    return hash;
  }
  let server;
  function expectedOrigin(request) {
    if (publicOrigin) {
      if (request.headers.host !== new URL(publicOrigin).host) throw new HttpError(403, 'invalid_host', 'Host no permitido.');
      return publicOrigin;
    }
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : null;
    const localHost = host === '::1' ? '[::1]' : host;
    const expectedHost = `${localHost}:${port}`;
    if (request.headers.host !== expectedHost) throw new HttpError(403, 'invalid_host', 'Host no permitido.');
    return `http://${expectedHost}`;
  }

  server = http.createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'same-origin');
    response.setHeader('X-Frame-Options', 'SAMEORIGIN');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; media-src 'self'; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'");
    try {
      const origin = expectedOrigin(request);
      const pathname = requestPath(request);
      const method = request.method;
      if (!['GET', 'HEAD'].includes(method)) {
        if (request.headers.origin !== origin) throw new HttpError(403, 'invalid_origin', 'La solicitud debe proceder de este sitio.');
      }
      if (pathname === '/api/admin/login' && method === 'POST') {
        const key = request.socket.remoteAddress || 'unknown';
        for (const [ip, entry] of loginAttempts) if (entry.until <= now()) loginAttempts.delete(ip);
        const attempt = loginAttempts.get(key) || { count: 0, until: now() + 15 * 60 * 1000 };
        if (attempt.count >= 5) {
          response.setHeader('Retry-After', String(Math.ceil((attempt.until - now()) / 1000)));
          throw new HttpError(429, 'login_rate_limited', 'Demasiados intentos. Vuelve a intentarlo más tarde.');
        }
        attempt.count++;
        loginAttempts.set(key, attempt);
        const body = await readJson(request);
        const candidate = typeof body.password === 'string' && body.password.length <= 1024 ? body.password : '';
        const suppliedHash = await scrypt(candidate, salt, 64);
        if (!timingSafeEqual(suppliedHash, passwordHash)) throw new HttpError(401, 'invalid_credentials', 'Contraseña incorrecta.');
        loginAttempts.delete(key);
        const oldSession = authenticated(request);
        if (oldSession) sessions.delete(oldSession);
        for (const [key, expiration] of sessions) if (expiration <= now()) sessions.delete(key);
        if (sessions.size >= 100) sessions.delete(sessions.keys().next().value);
        const token = randomBytes(32).toString('base64url');
        sessions.set(sessionHash(token), now() + sessionLife);
        return json(response, 200, { ok: true }, { 'Set-Cookie': cookie(token, sessionLife / 1000) });
      }
      if (pathname.startsWith('/api/admin/')) {
        const session = authenticated(request);
        if (!session) throw new HttpError(401, 'authentication_required', 'Inicia sesión para continuar.');
        if (pathname === '/api/admin/session' && method === 'GET') return json(response, 200, { authenticated: true });
        if (pathname === '/api/admin/logout' && method === 'POST') {
          await readJson(request);
          sessions.delete(session);
          return json(response, 200, { ok: true }, { 'Set-Cookie': cookie('', 0) });
        }
        if (pathname === '/api/admin/content' && method === 'GET') return json(response, 200, await store.getContent());
        if (pathname === '/api/admin/content' && method === 'PUT') {
          const body = await readJson(request);
          if (Object.keys(body).some(key => !['content', 'revision'].includes(key)) || typeof body.revision !== 'string') {
            throw new HttpError(422, 'invalid_content_request', 'Faltan el contenido o su revisión.');
          }
          return json(response, 200, await store.setContent(body.content, body.revision));
        }
        if (pathname === '/api/admin/applications' && method === 'GET') {
          return json(response, 200, { applications: await store.getApplications(), intakeEnabled: false });
        }
        const match = /^\/api\/admin\/applications\/([a-zA-Z0-9-]{1,100})$/.exec(pathname);
        if (match && method === 'PATCH') return json(response, 200, await store.updateApplication(match[1], await readJson(request)));
        throw new HttpError(404, 'not_found', 'No encontrado.');
      }
      if (pathname === '/api/public/config' && method === 'GET') return json(response, 200, { intakeEnabled: false });
      if (pathname === '/content/site.json' && ['GET', 'HEAD'].includes(method)) {
        const { content } = await store.getContent();
        if (method === 'HEAD') { response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); return response.end(); }
        return json(response, 200, content);
      }
      if (pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(method)) throw new HttpError(404, 'not_found', 'No encontrado.');
      const admin = pathname === '/admin' || pathname.startsWith('/admin/');
      const directory = admin ? adminDir : clientDir;
      const relative = admin ? pathname.slice('/admin'.length).replace(/^\//, '') : pathname.slice(1);
      if (await serveStatic(request, response, directory, relative || 'index.html')) return;
      throw new HttpError(404, 'not_found', 'No encontrado.');
    } catch (error) {
      if (response.headersSent) return response.destroy();
      const status = error instanceof HttpError ? error.status : 500;
      json(response, status, {
        error: error instanceof HttpError ? error.error : 'internal_error',
        message: error instanceof HttpError ? error.message : 'No se pudo completar la operación.',
        ...(error instanceof HttpError && error.errors ? { errors: error.errors } : {}),
      });
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  server.kompas = { host, dataDir, passwordFile, publicOrigin, intakeEnabled: false };
  server.on('close', () => { sessions.clear(); loginAttempts.clear(); passwordHash.fill(0); });
  return server;
}
