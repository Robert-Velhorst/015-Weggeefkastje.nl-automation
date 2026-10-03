import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export function writeHeartbeat(dataDir: string, service: 'worker' | 'backup'): void {
  const path = join(dataDir, 'runtime', `${service}.json`);
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify({ pid: process.pid, updatedAt: new Date().toISOString() }), { mode: 0o600 });
  renameSync(temporary, path);
}

export function heartbeatHealthy(dataDir: string, service: 'worker' | 'backup', maximumAgeMs: number): boolean {
  try {
    const data = JSON.parse(readFileSync(join(dataDir, 'runtime', `${service}.json`), 'utf8')) as { pid: number; updatedAt: string };
    process.kill(data.pid, 0);
    const age = Date.now() - Date.parse(data.updatedAt);
    return Number.isFinite(age) && age >= -5000 && age < maximumAgeMs;
  } catch { return false; }
}
