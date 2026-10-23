import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { AppDatabase } from '../src/db/appDatabase.js';
import { createApp } from '../src/api/app.js';
import { createVerifiedBackup, pruneVerifiedBackups, restoreVerifiedBackup } from '../src/operations/backup.js';
import { heartbeatHealthy, writeHeartbeat } from '../src/operations/heartbeat.js';

const directories: string[] = [];
const handles: AppDatabase[] = [];
afterEach(() => {
  for (const db of handles.splice(0)) db.close();
  for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function harness(production = false, hiddenWebRoot = false) {
  const dir = mkdtempSync(join(tmpdir(), 'weggeef-production-'));
  directories.push(dir);
  const webRoot = join(dir, hiddenWebRoot ? '.release' : 'web');
  mkdirSync(join(webRoot, 'assets'), { recursive: true });
  writeFileSync(join(webRoot, 'index.html'), '<!doctype html><title>Weggeefkastje</title>');
  writeFileSync(join(webRoot, 'assets', 'index-abcdefgh.js'), 'console.log("asset")');
  const config = loadConfig({ NODE_ENV: production ? 'production' : 'test', APP_DATA_DIR: dir, WEB_DIST_PATH: webRoot, APP_BASE_URL: 'https://kastjes.example.nl', BACKUP_KEEP_COUNT: '2' }, dir);
  const db = new AppDatabase(config.databasePath);
  handles.push(db);
  return { config, db, dir };
}
const setup = { email: 'owner@example.nl', password: 'correct-horse-battery', displayName: 'Owner', workspaceName: 'Pilot' };

describe('production configuration', () => {
  it('requires HTTPS, secure cookies and local CLI setup even on loopback', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/HTTPS/);
    expect(() => loadConfig({ NODE_ENV: 'production', APP_BASE_URL: 'http://localhost' })).toThrow(/HTTPS/);
    expect(() => loadConfig({ NODE_ENV: 'production', APP_BASE_URL: 'https://example.nl', COOKIE_SECURE: 'false' })).toThrow(/Secure cookies/);
    expect(() => loadConfig({ NODE_ENV: 'production', APP_BASE_URL: 'https://example.nl', ALLOW_REMOTE_SETUP: 'true' })).toThrow(/Remote first setup/);
    expect(() => loadConfig({ APP_BASE_URL: 'https://example.nl/private' })).toThrow(/origin/);
    expect(loadConfig({ NODE_ENV: 'production', APP_BASE_URL: 'https://example.nl' }).secureCookies).toBe(true);
  });
});

describe('recoverable worker leases', () => {
  it('prevents concurrent claims and fences expired owners out of completion', () => {
    const { db, config } = harness();
    const second = new AppDatabase(config.databasePath); handles.push(second);
    const queued = db.queueJob({ jobType: 'cleanup_sessions', idempotencyKey: 'lease-test' });
    const now = new Date();
    const first = db.claimNextJob(30_000, now)!;
    expect(first.id).toBe(queued.id);
    expect(second.claimNextJob(30_000, now)).toBeUndefined();
    const recovered = second.claimNextJob(30_000, new Date(now.getTime() + 30_001))!;
    expect(recovered.attempts).toBe(2);
    expect(recovered.leaseToken).not.toBe(first.leaseToken);
    expect(db.completeJob(first.id, first.leaseToken!)).toBe(false);
    expect(db.renewJobLease(first.id, first.leaseToken!)).toBe(false);
    db.failJob(first.id, 'stale owner', first.leaseToken!);
    expect(second.completeJob(recovered.id, recovered.leaseToken!)).toBe(true);
    expect(db.claimNextJob()).toBeUndefined();
  });
  it('does not retry crashed tasks indefinitely', () => {
    const { db } = harness();
    db.queueJob({ jobType: 'cleanup_sessions', idempotencyKey: 'attempts-test', maxAttempts: 1 });
    const now = new Date();
    const job = db.claimNextJob(30_000, now)!;
    expect(db.claimNextJob(30_000, new Date(now.getTime() + 30_001))).toBeUndefined();
    expect(db.completeJob(job.id, job.leaseToken!)).toBe(false);
  });
});

describe('verified backup and offline restore', () => {
  it('backs up WAL writes, restores a snapshot and preserves the newer recovery state', async () => {
    const { db, config } = harness();
    db.bootstrapAdmin(setup);
    const snapshot = await createVerifiedBackup(config);
    db.queueJob({ jobType: 'cleanup_sessions', idempotencyKey: 'after-snapshot' });
    handles.splice(handles.indexOf(db), 1); db.close();
    const result = await restoreVerifiedBackup(config, snapshot);
    const restored = new AppDatabase(config.databasePath); handles.push(restored);
    expect(restored.diagnostics().ok).toBe(true);
    expect(restored.claimNextJob()).toBeUndefined();
    const recovery = new AppDatabase(result.recoveryCopy!); handles.push(recovery);
    expect(recovery.claimNextJob()?.idempotencyKey).toBe('after-snapshot');
    expect(readFileSync(`${snapshot}.sha256`, 'utf8')).toMatch(/^[a-f0-9]{64}\n$/);
  });
  it('rejects corrupt input, checksum mismatch and future schema without replacing the target', async () => {
    const { db, config, dir } = harness();
    db.bootstrapAdmin(setup);
    db.queueJob({ jobType: 'cleanup_sessions', idempotencyKey: 'preserved' });
    const corrupt = join(dir, 'corrupt.sqlite'); writeFileSync(corrupt, 'not sqlite');
    await expect(restoreVerifiedBackup(config, corrupt)).rejects.toThrow();
    const snapshot = await createVerifiedBackup(config);
    writeFileSync(`${snapshot}.sha256`, 'wrong');
    await expect(restoreVerifiedBackup(config, snapshot)).rejects.toThrow(/checksum/);
    const future = await createVerifiedBackup(config);
    const raw = new Database(future);
    raw.prepare("INSERT INTO schema_migrations VALUES (999, 'future', ?)").run(new Date().toISOString()); raw.close();
    // No checksum for this intentionally crafted schema fixture.
    const unchecksummed = join(dir, 'future.sqlite');
    const futureDb = new Database(future); await futureDb.backup(unchecksummed); futureDb.close();
    await expect(restoreVerifiedBackup(config, unchecksummed)).rejects.toThrow(/newer than/);
    expect(db.authenticate(setup.email, setup.password)).toBeDefined();
    expect(db.claimNextJob()?.idempotencyKey).toBe('preserved');
  });
  it('rotates only owned verified snapshots and retains operator files', async () => {
    const { db, config, dir } = harness(); db.bootstrapAdmin(setup);
    for (let i = 0; i < 3; i++) await createVerifiedBackup(config);
    writeFileSync(join(dir, 'backups', 'manual.sqlite'), 'operator copy');
    pruneVerifiedBackups(config);
    const names = readdirSync(join(dir, 'backups'));
    expect(names.filter(name => name.startsWith('weggeefkastjes-') && name.endsWith('.sqlite'))).toHaveLength(2);
    expect(names).toContain('manual.sqlite');
  });
});

describe('production HTTP boundary', () => {
  it('blocks browser setup and reports readiness only after CLI-equivalent bootstrap', async () => {
    const { db, config } = harness(true); const app = createApp(config, db);
    await request(app).post('/api/setup').send(setup).expect(403);
    await request(app).get('/ready').expect(503);
    db.bootstrapAdmin(setup);
    await request(app).get('/ready').expect(200);
    const login = await request(app).post('/api/auth/login').send({ email: setup.email, password: setup.password }).expect(200);
    expect(login.headers['set-cookie'][0]).toContain('Secure');
    expect(login.headers['set-cookie'][0]).toContain('HttpOnly');
  });
  it('returns useful status codes for malformed cookies, JSON, oversized bodies and missing assets', async () => {
    const { db, config } = harness(true); db.bootstrapAdmin(setup); const app = createApp(config, db);
    await request(app).get('/api/dashboard').set('Cookie', 'wk_session=%ZZ').expect(401);
    await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad').expect(400);
    await request(app).post('/api/auth/login').send({ password: 'a'.repeat(270_000) }).expect(413);
    await request(app).get('/assets/missing.js').expect(404);
    const hashed = await request(app).get('/assets/index-abcdefgh.js').expect(200);
    expect(hashed.headers['cache-control']).toContain('immutable');
    for (const path of ['/', '/beheer', '/kastje-bijwerken/bearer']) {
      const page = await request(app).get(path).expect(200);
      expect(page.headers['cache-control']).toBe('no-store');
    }
  });
  it('serves an explicit hidden release root without exposing dotfiles', async () => {
    const { db, config } = harness(true, true);
    writeFileSync(join(config.webDistPath, '.env'), 'synthetic-private-value');
    const app = createApp(config, db);
    for (const path of ['/', '/beheer', '/kastje-bijwerken/bearer']) {
      await request(app).get(path).expect(200);
    }
    await request(app).get('/assets/index-abcdefgh.js').expect(200);
    const denied = await request(app).get('/.env').expect(404);
    expect(denied.text).not.toContain('synthetic-private-value');
  });
  it('tracks service heartbeat and does not accept missing or stale state', () => {
    const { dir } = harness();
    expect(heartbeatHealthy(dir, 'worker', 90_000)).toBe(false);
    writeHeartbeat(dir, 'worker');
    expect(heartbeatHealthy(dir, 'worker', 90_000)).toBe(true);
    writeFileSync(join(dir, 'runtime', 'worker.json'), JSON.stringify({ pid: process.pid, updatedAt: '2020-01-01T00:00:00Z' }));
    expect(heartbeatHealthy(dir, 'worker', 90_000)).toBe(false);
  });
});
