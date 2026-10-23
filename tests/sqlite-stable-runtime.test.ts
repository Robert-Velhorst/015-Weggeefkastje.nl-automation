import { afterEach, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';
import { assertStableSqliteRuntime, REQUIRED_SQLITE_VERSION } from '../src/db/stableRuntime.js';

afterEach(() => { vi.doUnmock('better-sqlite3'); vi.resetModules(); });

it('uses the actual current SQLite engine with integrity, FTS and JSON support', () => {
  assertStableSqliteRuntime();
  const database = new Database(':memory:');
  try {
    expect(database.prepare('SELECT sqlite_version() AS version').get()).toEqual({version: REQUIRED_SQLITE_VERSION});
    database.exec('CREATE VIRTUAL TABLE search USING fts5(value)');
    database.prepare('INSERT INTO search VALUES (?)').run('synthetic stable engine');
    expect(database.prepare("SELECT count(*) AS n FROM search WHERE search MATCH 'stable'").get()).toEqual({n: 1});
    expect(database.prepare("SELECT json_extract('{\"n\":2}', '$.n') AS n").get()).toEqual({n:2});
    expect(database.pragma('integrity_check', {simple:true})).toBe('ok');
  } finally { database.close(); }
});

it('rejects an older engine before creating an application data directory', async () => {
  vi.resetModules();
  vi.doMock('better-sqlite3', () => ({default: class {
    prepare() { return {get() { return {version:'3.53.4'}; }}; }
    close() {}
  }}));
  const directory = mkdtempSync(join(tmpdir(), 'weggeef-engine-guard-'));
  const path = join(directory, 'untouched', 'operator.sqlite');
  try {
    const { AppDatabase } = await import('../src/db/appDatabase.js');
    expect(() => new AppDatabase(path)).toThrow(/SQLite 3\.54\.1 required/);
    expect(existsSync(join(directory, 'untouched'))).toBe(false);
    const { openDatabase } = await import('../src/db/sqlite.js');
    expect(() => openDatabase(path)).toThrow(/SQLite 3\.54\.1 required/);
    expect(existsSync(join(directory, 'untouched'))).toBe(false);
  } finally { rmSync(directory, {recursive:true, force:true}); }
});
