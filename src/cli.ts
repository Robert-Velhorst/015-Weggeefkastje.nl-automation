import 'dotenv/config';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { loadConfig, publicConfig, resolveWithin } from './config.js';
import { AppDatabase } from './db/appDatabase.js';
import { runOneJob, scheduleRecurringJobs } from './jobs/runner.js';
import { createVerifiedBackup, restoreVerifiedBackup } from './operations/backup.js';
import { setupSchema } from './auth/setupInput.js';

process.umask(0o077);

const config = loadConfig();
const [command = 'help', ...args] = process.argv.slice(2);

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function value(flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main(): Promise<void> {
  if (command === 'bootstrap') {
    if (process.stdin.isTTY) throw new Error('Provide setup JSON on stdin, never as command-line arguments.');
    let input = '';
    for await (const chunk of process.stdin) {
      input += chunk.toString();
      if (Buffer.byteLength(input) > 4096) throw new Error('Setup input exceeds 4 KB.');
    }
    const setup = setupSchema.parse(JSON.parse(input));
    const database = new AppDatabase(config.databasePath);
    try { console.log(JSON.stringify(database.bootstrapAdmin(setup))); } finally { database.close(); }
    return;
  }
  if (command === 'migrate') {
    const database = new AppDatabase(config.databasePath);
    console.log(JSON.stringify({ database: config.databasePath, migration: database.migrationResult }, null, 2));
    database.close();
    return;
  }
  if (command === 'doctor') {
    const database = new AppDatabase(config.databasePath);
    const result = { config: publicConfig(config), diagnostics: database.diagnostics() };
    database.close();
    console.log(JSON.stringify(result, null, 2));
    if (!(result.diagnostics as { ok: boolean }).ok) process.exitCode = 1;
    return;
  }
  if (command === 'reconcile') {
    const database = new AppDatabase(config.databasePath);
    const diagnostics = database.diagnostics();
    database.close();
    console.log(JSON.stringify({ mode: 'read-only', diagnostics }, null, 2));
    if (!(diagnostics as { ok: boolean }).ok) process.exitCode = 1;
    return;
  }
  if (command === 'ready-for-tunnel') {
    const database = new AppDatabase(config.databasePath);
    const readiness = database.readiness();
    database.close();
    const safe = readiness.ok && !readiness.setupRequired && config.baseUrl?.startsWith('https://') && config.secureCookies && config.trustProxy && !config.allowRemoteSetup;
    console.log(JSON.stringify({ readyForTunnel: Boolean(safe), baseUrl: config.baseUrl, secureCookies: config.secureCookies, trustProxy: config.trustProxy, remoteSetupAllowed: config.allowRemoteSetup, readiness }, null, 2));
    if (!safe) process.exitCode = 1;
    return;
  }
  if (command === 'backup') {
    console.log(await createVerifiedBackup(config));
    return;
  }
  if (command === 'restore') {
    const sourceArg = value('--from');
    if (!sourceArg || !args.includes('--confirm') || !args.includes('--confirm-services-stopped')) throw new Error('Stop app, worker and backup service; then restore --from data/backups/file.sqlite --confirm --confirm-services-stopped');
    const source = resolveWithin(config.dataDir, resolve(sourceArg));
    console.log(JSON.stringify(await restoreVerifiedBackup(config, source), null, 2));
    return;
  }
  if (command === 'export') {
    const database = new AppDatabase(config.databasePath);
    const workspace = value('--workspace') ?? database.workspaceIds()[0];
    if (!workspace) throw new Error('No workspace exists.');
    const output = resolveWithin(config.dataDir, value('--out') ? resolve(value('--out')!) : join(config.dataDir, 'exports', `workspace-${stamp()}.json`));
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, JSON.stringify(database.workspaceExport(workspace), null, 2));
    database.close();
    console.log(output);
    return;
  }
  if (command === 'support-bundle') {
    const database = new AppDatabase(config.databasePath);
    const output = resolveWithin(config.dataDir, join(config.dataDir, 'support', `support-${stamp()}.json`));
    mkdirSync(dirname(output), { recursive: true });
    const body = { generatedAt: new Date().toISOString(), version: process.env.npm_package_version ?? 'unknown', config: publicConfig(config), diagnostics: database.diagnostics() };
    database.close();
    writeFileSync(output, JSON.stringify(body, null, 2));
    console.log(output);
    return;
  }
  if (command === 'worker') {
    const database = new AppDatabase(config.databasePath);
    scheduleRecurringJobs(database, config);
    while (await runOneJob(database, config)) { /* drain */ }
    database.close();
    return;
  }
  if (command === 'checksum') {
    const fileArg = value('--file');
    if (!fileArg) throw new Error('Usage: npm run cli -- checksum --file data/backups/file.sqlite');
    const file = resolveWithin(config.dataDir, resolve(fileArg));
    console.log(`${createHash('sha256').update(readFileSync(file)).digest('hex')}  ${basename(file)}`);
    return;
  }
  console.log('Commands: bootstrap (JSON on stdin), migrate, doctor, reconcile, ready-for-tunnel, backup, restore, export, support-bundle, worker, checksum');
}

main().catch(() => {
  // Validation errors may contain supplied secrets. Keep failure output private-data free.
  console.error('Command failed. Check arguments, permissions, input validity and the operator runbook.');
  process.exitCode = 1;
});
