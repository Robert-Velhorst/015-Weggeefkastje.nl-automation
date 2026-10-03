import 'dotenv/config';
import { loadConfig } from './config.js';
import { createVerifiedBackup, pruneVerifiedBackups } from './operations/backup.js';
import { writeHeartbeat } from './operations/heartbeat.js';

process.umask(0o077);
const config = loadConfig();
let stopping = false;
let wake: (() => void) | undefined;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { stopping = true; wake?.(); });
try {
  do {
    const path = await createVerifiedBackup(config);
    pruneVerifiedBackups(config);
    writeHeartbeat(config.dataDir, 'backup');
    console.log(JSON.stringify({ event: 'backup.succeeded', path }));
    if (process.argv.includes('--once') || stopping) break;
    await new Promise<void>(resolve => {
      const timer = setTimeout(resolve, config.backupIntervalHours * 3_600_000);
      wake = () => { clearTimeout(timer); resolve(); };
      if (stopping) wake();
    });
  } while (!stopping);
} catch {
  console.error(JSON.stringify({ event: 'backup.failed' }));
  process.exitCode = 1;
}
