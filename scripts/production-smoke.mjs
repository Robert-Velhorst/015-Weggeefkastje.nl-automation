// Reproducible compiled-runtime check. All data is synthetic and confined to a new temp directory.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { AppDatabase } from '../dist/db/appDatabase.js';

const directory = mkdtempSync(join(tmpdir(), 'weggeef-compiled-smoke-'));
const portFinder = createServer();
await new Promise(resolve => portFinder.listen(0, '127.0.0.1', resolve));
const port = portFinder.address().port;
await new Promise(resolve => portFinder.close(resolve));
const env = {
  ...process.env, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port),
  APP_DATA_DIR: directory, DATABASE_PATH: join(directory, 'smoke.sqlite'),
  WEB_DIST_PATH: resolve('dist-web'), APP_BASE_URL: 'https://smoke.example.nl',
  ALLOW_REMOTE_SETUP: 'false', ALLOW_NETWORK_BINDING: 'false', TRUST_PROXY: 'true', COOKIE_SECURE: 'true', ENABLE_DEMO_MODE: 'false',
  PUBLIC_WORKSPACE_ID: '', HAI_FEED_TOKEN: '', HAI_WORKSPACE_ID: '', FACEBOOK_GRAPH_ACCESS_TOKEN: '', FACEBOOK_GRAPH_API_VERSION: '',
  FACEBOOK_PAGE_CONTEXTS_JSON: '[]', NEXTDOOR_APPROVED_EXPORT_PATH: '', BUURTKASTJESKAART_EXPORT_PATH: '', OSM_OVERPASS_URL: '', OSM_PILOT_BBOX: '',
};
let server;
let serverOutput = '';
let location;
const credentials = { email: 'smoke@example.nl', password: randomUUID() + randomUUID(), displayName: 'Test owner', workspaceName: 'Synthetic QA' };

function command(file, args = [], input = '') {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [file, ...args], { env, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', data => { output += data; });
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error(`Timed out: ${file}`)); }, 45_000);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('exit', code => {
      clearTimeout(timer);
      if (code === 0) resolve(output.trim());
      else reject(new Error(`Command failed: ${file} (${code})`));
    });
    child.stdin.end(input);
  });
}
async function stop() {
  if (!server || server.exitCode !== null) return;
  const child = server;
  await new Promise(resolve => {
    const timer = setTimeout(() => { child.kill('SIGKILL'); }, 12_000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
    child.kill('SIGTERM');
  });
}
async function start() {
  server = spawn(process.execPath, ['dist/server-main.js'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', data => { serverOutput += data; });
  server.stderr.on('data', () => {});
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error('Server exited before readiness.');
    try {
      const response = await fetch(`http://127.0.0.1:${port}/ready`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch { /* startup */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Server readiness timed out.');
}
async function http(path, expected = 200, options = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, { signal: AbortSignal.timeout(5000), ...options });
  assert.equal(response.status, expected, path);
  return response;
}

try {
  const identity = JSON.parse(await command('dist/cli.js', ['bootstrap'], JSON.stringify(credentials)));
  env.PUBLIC_WORKSPACE_ID = identity.workspaceId;
  const db = new AppDatabase(env.DATABASE_PATH);
  try {
    const source = db.createSource(identity.workspaceId, identity.userId, {
      key: 'synthetic-smoke', name: 'Synthetic fixture', accessMode: 'approved_export', authorizationReference: 'Synthetic test only',
      attribution: 'Synthetic test only', publicationMode: 'automatic', enabled: true, allowsExactAddress: true,
    });
    location = db.upsertVerifiedResidentLocation(identity.workspaceId, identity.userId, source, {
      sourceKey: source.key, title: 'QA boekenkastje', address: 'Voorbeeldstraat 10', postalCode: '1234AB', city: 'Utrecht',
      observedAt: new Date().toISOString(), evidenceSummary: 'PRIVATE QA EVIDENCE', categories: ['Boeken'], status: 'active',
    }, { addressLine: 'Voorbeeldstraat 10', postalCode: '1234AB', city: 'Utrecht', latitude: 52.09, longitude: 5.12, provider: 'pdok', verifiedAt: new Date().toISOString() });
  } finally { db.close(); }
  await start();
  const home = await http('/'); assert.match(await home.text(), /<div id="root"><\/div>/);
  await http('/assets/nonexistent.js', 404);
  await http('/api/setup', 403, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(credentials) });
  const publicData = await (await http('/api/public/locations?category=Boeken')).json();
  assert.equal(publicData.data.total, 1);
  assert.ok(!JSON.stringify(publicData).includes('PRIVATE QA EVIDENCE'));
  await http('/api/public/locations?category=Planten').then(async response => assert.equal((await response.json()).data.total, 0));
  await http(`/api/public/locations/${location.id}/reports`, 202, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason: 'Synthetic report for persistence check.' }) });
  await http('/api/dashboard', 401);
  const login = await http('/api/auth/login', 200, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(credentials) });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  assert.match(login.headers.get('set-cookie'), /Secure/);
  const csrf = (await login.json()).data.session.csrfToken;
  const headers = { cookie, 'content-type': 'application/json', 'x-csrf-token': csrf };
  await http('/api/auth/me', 200, { headers });
  await http('/api/operator/safety-stop', 403, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: '{"enabled":true}' });
  await http('/api/operator/safety-stop', 200, { method: 'POST', headers, body: '{"enabled":true}' });
  await stop(); await start();
  const settings = await (await http('/api/settings', 200, { headers })).json();
  assert.equal(settings.data.safetyStop, true);
  await command('dist/healthcheck.js', ['server']);
  await command('dist/worker.js', ['--once']);
  await command('dist/backup-worker.js', ['--once']);
  await http('/api/auth/logout', 200, { method: 'POST', headers, body: '{}' });
  await http('/api/auth/me', 401, { headers });
  assert.ok(!serverOutput.includes(credentials.password));
  assert.ok(existsSync(join(directory, 'backups')));
  console.log(JSON.stringify({ ok: true, checks: ['compiled CLI bootstrap', 'production readiness', 'public filtering and privacy', 'report submission', 'auth and CSRF', 'restart persistence', 'compiled worker', 'verified backup', 'logout'], externalProviders: 'not exercised', tls: 'not exercised; loopback upstream only' }));
} finally {
  await stop();
  rmSync(directory, { recursive: true, force: true });
}
