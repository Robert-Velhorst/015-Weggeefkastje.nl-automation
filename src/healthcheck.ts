import { loadConfig } from './config.js';
import { heartbeatHealthy } from './operations/heartbeat.js';

const config = loadConfig();
const service = process.argv[2] ?? 'server';
if (service === 'worker' || service === 'backup') {
  process.exitCode = heartbeatHealthy(config.dataDir, service, service === 'worker' ? 90_000 : (config.backupIntervalHours * 3600 + 300) * 1000) ? 0 : 1;
} else {
  try {
    const response = await fetch(`http://127.0.0.1:${config.port}/ready`, { signal: AbortSignal.timeout(4000) });
    process.exitCode = response.ok ? 0 : 1;
  } catch { process.exitCode = 1; }
}
