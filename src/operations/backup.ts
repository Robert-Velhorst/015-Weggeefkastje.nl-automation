import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { AppDatabase } from '../db/appDatabase.js';
import { resolveWithin, type AppConfig } from '../config.js';

function validate(path: string): void {
  const db = new Database(path, { readonly: true, fileMustExist: true });
  try {
    const integrity = db.pragma('integrity_check') as Array<{ integrity_check: string }>;
    if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok' || (db.pragma('foreign_key_check') as unknown[]).length) {
      throw new Error('Backup failed SQLite integrity or foreign key checks.');
    }
    for (const name of ['schema_migrations', 'users', 'workspaces', 'jobs']) {
      if (!db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name)) {
        throw new Error('Backup is not an application database.');
      }
    }
  } finally { db.close(); }
}

export async function createVerifiedBackup(config: AppConfig): Promise<string> {
  if (!existsSync(config.databasePath)) throw new Error('Database does not exist.');
  const folder = resolveWithin(config.dataDir, 'backups');
  mkdirSync(folder, { recursive: true, mode: 0o700 });
  const destination = join(folder, `weggeefkastjes-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}.sqlite`);
  const db = new Database(config.databasePath, { readonly: true, fileMustExist: true });
  try {
    await db.backup(destination);
    validate(destination);
    writeFileSync(`${destination}.sha256`, createHash('sha256').update(readFileSync(destination)).digest('hex') + '\n', { mode: 0o600 });
  } catch (error) {
    // Delete only this invocation's unique, unverified output, never an earlier snapshot.
    if (existsSync(destination)) unlinkSync(destination);
    if (existsSync(`${destination}.sha256`)) unlinkSync(`${destination}.sha256`);
    throw error;
  } finally { db.close(); }
  return destination;
}

export function pruneVerifiedBackups(config: AppConfig): void {
  const folder = resolveWithin(config.dataDir, 'backups');
  const owned = readdirSync(folder).filter(name => /^weggeefkastjes-\d{4}-\d{2}-\d{2}T[\dTZ-]+-[a-f0-9-]{36}\.sqlite$/.test(name))
    .filter(name => existsSync(join(folder, `${name}.sha256`))).sort().reverse();
  for (const name of owned.slice(config.backupKeepCount)) {
    const file = resolveWithin(folder, name);
    unlinkSync(file);
    unlinkSync(`${file}.sha256`);
  }
}

// Caller MUST stop app, worker and backup service before invoking this offline operation.
export async function restoreVerifiedBackup(config: AppConfig, sourcePath: string): Promise<{ restoredFrom: string; recoveryCopy?: string }> {
  const source = resolveWithin(config.dataDir, sourcePath);
  if (resolve(source) === resolve(config.databasePath)) throw new Error('Cannot restore a database onto itself.');
  validate(source);
  if (existsSync(`${source}.sha256`)) {
    const expected = readFileSync(`${source}.sha256`, 'utf8').trim();
    if (createHash('sha256').update(readFileSync(source)).digest('hex') !== expected) throw new Error('Backup checksum mismatch.');
  }
  mkdirSync(dirname(config.databasePath), { recursive: true });
  const stage = `${config.databasePath}.restore-${randomUUID()}`;
  const snapshot = new Database(source, { readonly: true, fileMustExist: true });
  try { await snapshot.backup(stage); } finally { snapshot.close(); }
  const moved: Array<[string, string]> = [];
  let recoveryCopy: string | undefined;
  try {
    // Migration and full validation happen on a staging database, never on the live target.
    const staged = new AppDatabase(stage);
    try {
      if (!staged.diagnostics().ok) throw new Error('Restored staging database failed validation.');
    } finally { staged.close(); }
    if (existsSync(config.databasePath)) {
      recoveryCopy = await createVerifiedBackup(config);
      const target = new Database(config.databasePath, { fileMustExist: true, timeout: 1000 });
      try {
        const result = target.pragma('wal_checkpoint(TRUNCATE)') as Array<{ busy: number }>;
        if (result.some(row => row.busy !== 0)) throw new Error('Database is busy. Stop all services before restoring.');
      } finally { target.close(); }
    }
    const recoveryBase = `${config.databasePath}.pre-restore-${randomUUID()}`;
    for (const suffix of ['', '-wal', '-shm']) {
      const original = `${config.databasePath}${suffix}`;
      if (existsSync(original)) {
        const saved = `${recoveryBase}${suffix}`;
        renameSync(original, saved);
        moved.push([original, saved]);
      }
    }
    renameSync(stage, config.databasePath);
    return { restoredFrom: source, recoveryCopy };
  } catch (error) {
    for (const [original, saved] of moved.reverse()) renameSync(saved, original);
    throw error;
  } finally {
    for (const suffix of ['', '-wal', '-shm']) {
      if (existsSync(`${stage}${suffix}`)) unlinkSync(`${stage}${suffix}`);
    }
  }
}
