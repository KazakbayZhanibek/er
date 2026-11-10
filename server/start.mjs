import { createAdminServer } from './admin-server.mjs';

const host = process.env.KOMPAS_HOST || '127.0.0.1';
const port = Number(process.env.KOMPAS_PORT || 4174);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('KOMPAS_PORT must be between 1 and 65535.');
const server = await createAdminServer({
  host,
  password: process.env.KOMPAS_ADMIN_PASSWORD,
  origin: process.env.KOMPAS_PUBLIC_ORIGIN,
  dataDir: process.env.KOMPAS_DATA_DIR,
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });
const url = server.kompas.publicOrigin || `http://${host === '::1' ? '[::1]' : host}:${port}`;
console.log(`Kompas: ${url}`);
console.log(`Private editor: ${url}/admin/`);
console.log('Public application intake is disabled.');
if (server.kompas.passwordFile) console.log(`Local administrator password file: ${server.kompas.passwordFile}`);
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));
