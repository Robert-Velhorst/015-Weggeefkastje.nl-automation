import 'dotenv/config';
import { loadConfig } from './config.js';
import { AppDatabase } from './db/appDatabase.js';
import { runOneJob, scheduleRecurringJobs } from './jobs/runner.js';
import { writeHeartbeat } from './operations/heartbeat.js';

const once = process.argv.includes('--once');
process.umask(0o077);
const config = loadConfig();
const database = new AppDatabase(config.databasePath);
let scheduledDay = '';
let stopping = false;
let wake: (() => void) | undefined;

async function tick(): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== scheduledDay) {
    scheduleRecurringJobs(database, config);
    scheduledDay = today;
  }
  return runOneJob(database, config);
}

async function main(): Promise<void> {
  const heartbeat = once ? undefined : setInterval(() => writeHeartbeat(config.dataDir, 'worker'), 30_000);
  try {
    if (!once) writeHeartbeat(config.dataDir, 'worker');
    while (!stopping) {
      const handled = await tick();
      if (once && !handled) break;
      if (!handled) await new Promise<void>(resolve => {
        const timer = setTimeout(resolve, config.workerPollMs);
        wake = () => { clearTimeout(timer); resolve(); };
        if (stopping) wake();
      });
    }
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    database.close();
  }
}

function shutdown(): void {
  if (stopping) return;
  stopping = true;
  wake?.();
  // Finish the active task; after a hard termination its lease makes it recoverable.
  setTimeout(() => process.exit(1), 30_000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main().catch(() => {
  console.error(JSON.stringify({ event: 'worker.fatal' }));
  process.exitCode = 1;
});
