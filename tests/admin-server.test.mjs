import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, rm, stat, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createAdminServer } from '../server/admin-server.mjs';

const initialContent = JSON.parse(await readFile(new URL('../src/content/site.json', import.meta.url), 'utf8'));
const password = 'test-only-long-passphrase-2030';

async function fixture(t, options = {}) {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'kompas-admin-test-'));
  const clientDir = path.join(rootDir, 'dist/client');
  const adminDir = path.join(rootDir, 'dist/admin');
  const dataDir = path.join(rootDir, '.kompas-data');
  await Promise.all([mkdir(clientDir, { recursive: true }), mkdir(adminDir, { recursive: true }), mkdir(dataDir)]);
  await writeFile(path.join(clientDir, 'index.html'), '<h1>Public Kompas</h1>');
  await writeFile(path.join(adminDir, 'index.html'), '<h1>Private editor login</h1>');
  await writeFile(path.join(clientDir, 'sample.mp4'), 'abcdefghijkl');
  if (options.applications) await writeFile(path.join(dataDir, 'applications.json'), JSON.stringify(options.applications), { mode: 0o600 });
  const config = { rootDir, clientDir, adminDir, dataDir, initialContent, password, ...options };
  const servers = [];
  const start = async () => {
    const server = await createAdminServer(config);
    servers.push(server);
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const base = `http://127.0.0.1:${server.address().port}`;
    return { server, base };
  };
  const running = await start();
  t.after(async () => {
    for (const server of servers) if (server.listening) await new Promise(resolve => server.close(resolve));
    await rm(rootDir, { recursive: true, force: true });
  });
  return { ...running, rootDir, clientDir, adminDir, dataDir, restart: start };
}

async function call(base, route, { method = 'GET', cookie, body, origin = base, headers = {} } = {}) {
  return fetch(base + route, {
    method,
    headers: { ...(method !== 'GET' && method !== 'HEAD' ? { Origin: origin, 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function login(base, requestHeaders = {}) {
  const response = await call(base, '/api/admin/login', { method: 'POST', body: { password }, headers: requestHeaders });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  const cookie = response.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Max-Age=28800/);
  return cookie.split(';')[0];
}

test('protects private endpoints, rotates logout, and expires sessions', async t => {
  let clock = Date.now();
  const { base } = await fixture(t, { now: () => clock });
  for (const route of ['/api/admin/session', '/api/admin/content', '/api/admin/applications']) {
    assert.equal((await call(base, route)).status, 401);
  }
  assert.equal((await call(base, '/api/admin/content', { method: 'PUT', body: { content: initialContent, revision: 'unknown' } })).status, 401);
  assert.equal((await call(base, '/api/admin/login', { method: 'POST', body: { password: 'wrong' } })).status, 401);
  const cookie = await login(base);
  assert.deepEqual(await (await call(base, '/api/admin/session', { cookie })).json(), { authenticated: true });
  assert.equal((await call(base, '/api/admin/logout', { method: 'POST', cookie, body: {} })).status, 200);
  assert.equal((await call(base, '/api/admin/session', { cookie })).status, 401);
  const nextCookie = await login(base);
  assert.notEqual(cookie, nextCookie);
  clock += 8 * 60 * 60 * 1000 + 1;
  assert.equal((await call(base, '/api/admin/session', { cookie: nextCookie })).status, 401);
});

test('rejects cross-origin, missing-origin, wrong-host and non-JSON writes', async t => {
  const { base } = await fixture(t);
  const cookie = await login(base);
  assert.equal((await call(base, '/api/admin/logout', { method: 'POST', cookie, body: {}, origin: 'https://foreign.example' })).status, 403);
  assert.equal((await fetch(base + '/api/admin/logout', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
  assert.equal((await call(base, '/api/admin/logout', { method: 'POST', cookie, body: {}, headers: { 'Content-Type': 'text/plain' } })).status, 415);
  const wrongHostStatus = await new Promise((resolve, reject) => {
    const request = http.request(base + '/api/admin/content', { headers: { Host: 'foreign.example', Cookie: cookie } }, response => {
      response.resume(); response.on('end', () => resolve(response.statusCode));
    });
    request.on('error', reject); request.end();
  });
  assert.equal(wrongHostStatus, 403);
  const response = await call(base, '/api/admin/session', { cookie });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});

test('persists validated content atomically and rejects stale writes', async t => {
  const env = await fixture(t);
  const cookie = await login(env.base);
  const original = await (await call(env.base, '/api/admin/content', { cookie })).json();
  assert.deepEqual(original.content, initialContent);
  const changed = structuredClone(initialContent);
  changed.texts.heroEyebrow = 'Una actualización de prueba';
  changed.blocks.push({ id: 'notice-test', title: 'Información', body: 'Texto de prueba.' });
  const update = await call(env.base, '/api/admin/content', { method: 'PUT', cookie, body: { content: changed, revision: original.revision } });
  assert.equal(update.status, 200);
  const saved = await update.json();
  assert.notEqual(saved.revision, original.revision);
  assert.deepEqual(saved.content, changed);
  assert.equal((await call(env.base, '/api/admin/content', { method: 'PUT', cookie, body: { content: initialContent, revision: original.revision } })).status, 409);
  assert.deepEqual(await (await call(env.base, '/content/site.json')).json(), changed);
  assert.equal((await stat(path.join(env.dataDir, 'content.json'))).mode & 0o777, 0o600);
  const restarted = await env.restart();
  assert.deepEqual(await (await call(restarted.base, '/content/site.json')).json(), changed);
});

test('rejects malformed, oversized and unknown content fields without changing saved content', async t => {
  const { base } = await fixture(t);
  const cookie = await login(base);
  const { revision } = await (await call(base, '/api/admin/content', { cookie })).json();
  for (const content of [{}, { ...initialContent, unknown: true }, { ...initialContent, blocks: [{ id: 'bad', title: '', body: 'test' }] }]) {
    assert.equal((await call(base, '/api/admin/content', { method: 'PUT', cookie, body: { content, revision } })).status, 422);
  }
  assert.equal((await call(base, '/api/admin/content', { method: 'PUT', cookie, body: { content: initialContent, revision, unexpected: true } })).status, 422);
  assert.equal((await call(base, '/api/admin/content', { method: 'PUT', cookie, body: { content: 'x'.repeat(70000), revision } })).status, 413);
  const malformed = await fetch(base + '/api/admin/content', { method: 'PUT', headers: { Origin: base, Cookie: cookie, 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(malformed.status, 400);
  assert.deepEqual(await (await call(base, '/content/site.json')).json(), initialContent);
});

test('rate-limits concurrent login attempts by network address', async t => {
  const { base } = await fixture(t);
  const responses = await Promise.all(Array.from({ length: 8 }, () => call(base, '/api/admin/login', { method: 'POST', body: { password: 'wrong-password' } })));
  assert.equal(responses.filter(response => response.status === 401).length, 5);
  assert.equal(responses.filter(response => response.status === 429).length, 3);
  assert.equal((await call(base, '/api/admin/login', { method: 'POST', body: { password } })).status, 429);
});

test('serves only built assets, supports video ranges, and never serves private files or symlinks', async t => {
  const env = await fixture(t);
  await symlink(path.join(env.dataDir, 'content.json'), path.join(env.clientDir, 'leak.json'));
  await symlink(env.dataDir, path.join(env.clientDir, 'storage'));
  assert.match(await (await call(env.base, '/')).text(), /Public Kompas/);
  assert.match(await (await call(env.base, '/admin/')).text(), /Private editor login/);
  for (const route of ['/src/content/site.json', '/server/admin-server.mjs', '/.kompas-data/content.json', '/leak.json', '/storage/applications.json', '/admin/../.kompas-data/content.json', '/%2e%2e/.kompas-data/content.json']) {
    assert.equal((await call(env.base, route)).status, 404, route);
  }
  const range = await call(env.base, '/sample.mp4', { headers: { Range: 'bytes=2-5' } });
  assert.equal(range.status, 206);
  assert.equal(range.headers.get('content-range'), 'bytes 2-5/12');
  assert.equal(await range.text(), 'cdef');
  assert.equal((await call(env.base, '/sample.mp4', { headers: { Range: 'bytes=99-100' } })).status, 416);
  assert.deepEqual(await (await call(env.base, '/api/public/config')).json(), { intakeEnabled: false });
  assert.equal((await call(env.base, '/api/applications', { method: 'POST', body: { fullName: 'Test' } })).status, 404);
  const cookie = await login(env.base);
  assert.deepEqual(await (await call(env.base, '/api/admin/applications', { cookie })).json(), { applications: [], intakeEnabled: false });
});

test('updates application states and notes while preserving private records across restart', async t => {
  const application = { id: 'fixture-1', type: 'candidate', createdAt: '2026-11-10T10:00:00Z', status: 'new', notes: '', fullName: 'Test Candidate', email: 'test@example.invalid', phone: '', city: '', area: '', message: 'Test cover letter', company: '', need: '' };
  const env = await fixture(t, { applications: [application] });
  const cookie = await login(env.base);
  for (const status of ['contacted', 'closed', 'new']) {
    const update = await call(env.base, '/api/admin/applications/fixture-1', { method: 'PATCH', cookie, body: { status, notes: `Estado ${status}` } });
    assert.equal(update.status, 200);
    assert.deepEqual((await update.json()).application, { ...application, status, notes: `Estado ${status}` });
  }
  assert.equal((await call(env.base, '/api/admin/applications/fixture-1', { method: 'PATCH', cookie, body: { status: 'deleted', notes: '' } })).status, 422);
  assert.equal((await call(env.base, '/api/admin/applications/fixture-1', { method: 'PATCH', cookie, body: { status: 'new', notes: '', email: 'changed@example.invalid' } })).status, 422);
  assert.equal((await call(env.base, '/api/admin/applications/missing', { method: 'PATCH', cookie, body: { status: 'closed', notes: '' } })).status, 404);
  const restarted = await env.restart();
  const newCookie = await login(restarted.base);
  const { applications } = await (await call(restarted.base, '/api/admin/applications', { cookie: newCookie })).json();
  assert.deepEqual(applications, [{ ...application, notes: 'Estado new' }]);
  assert.equal((await stat(path.join(env.dataDir, 'applications.json'))).mode & 0o777, 0o600);
});

test('creates a local password file privately and rejects unsafe external configuration', async t => {
  const env = await fixture(t, { password: undefined });
  const passwordPath = path.join(env.dataDir, 'local-admin-password');
  assert.equal((await stat(passwordPath)).mode & 0o777, 0o600);
  assert.match((await readFile(passwordPath, 'utf8')).trim(), /^[A-Za-z0-9_-]{43}$/);
  await assert.rejects(createAdminServer({ initialContent, host: '0.0.0.0', password }), /HTTPS/);
  await assert.rejects(createAdminServer({ initialContent, host: '0.0.0.0', origin: 'https://kompas.example' }), /PASSWORD/);
  await assert.rejects(createAdminServer({ initialContent, rootDir: env.rootDir, dataDir: path.join(env.clientDir, 'data') }), /outside/);
  for (const folder of ['public', 'src', 'admin/public', 'server']) {
    await assert.rejects(createAdminServer({ initialContent, rootDir: env.rootDir, dataDir: path.join(env.rootDir, folder, 'private-data') }), /outside/);
  }
  const publicDir = path.join(env.rootDir, 'public');
  await mkdir(publicDir);
  const linkedDirectory = await mkdtemp(path.join(os.tmpdir(), 'kompas-linked-data-test-'));
  t.after(() => rm(linkedDirectory, { recursive: true, force: true }));
  await symlink(publicDir, path.join(linkedDirectory, 'alias'));
  await assert.rejects(createAdminServer({ initialContent, rootDir: env.rootDir, dataDir: path.join(linkedDirectory, 'alias', 'private-data') }), /outside/);
  await assert.rejects(readFile(path.join(publicDir, 'private-data', 'local-admin-password')), { code: 'ENOENT' });
  await assert.rejects(createAdminServer({ initialContent, rootDir: env.rootDir, password: 'short' }), /16/);
});

test('uses Secure host-only cookies with an explicit HTTPS public origin', async t => {
  const { base } = await fixture(t, { host: '0.0.0.0', origin: 'https://kompas.example' });
  const result = await new Promise((resolve, reject) => {
    const body = JSON.stringify({ password });
    const request = http.request(base + '/api/admin/login', {
      method: 'POST', headers: { Host: 'kompas.example', Origin: 'https://kompas.example', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, response => {
      response.resume();
      response.on('end', () => resolve({ status: response.statusCode, cookie: response.headers['set-cookie']?.[0] }));
    });
    request.on('error', reject); request.end(body);
  });
  assert.equal(result.status, 200);
  assert.match(result.cookie, /^__Host-kompas_session=/);
  assert.match(result.cookie, /; Secure/);
  assert.doesNotMatch(result.cookie, /Domain=/i);
});
