import Database from 'better-sqlite3';

export const REQUIRED_SQLITE_VERSION = '3.54.1';
let verified = false;
/** Verify in memory before creating/opening any operator database. */
export function assertStableSqliteRuntime(): void {
  if (verified) return;
  const probe = new Database(':memory:');
  try {
    const row = probe.prepare('SELECT sqlite_version() AS version').get() as { version: string };
    if (row.version !== REQUIRED_SQLITE_VERSION) throw new Error(`SQLite ${REQUIRED_SQLITE_VERSION} required; run npm run build:sqlite before opening application data.`);
    verified = true;
  } finally { probe.close(); }
}
