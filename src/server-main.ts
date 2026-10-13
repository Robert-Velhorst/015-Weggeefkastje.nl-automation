import 'dotenv/config';
import { createServer } from 'node:http';
import { loadConfig } from './config.js';
import { AppDatabase } from './db/appDatabase.js';
import { createApp } from './api/app.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

process.umask(0o077);
const config = loadConfig();
if (config.mode === 'production' && !existsSync(join(config.webDistPath, 'index.html'))) throw new Error('Production website build is missing. Run npm run build.');
const database = new AppDatabase(config.databasePath);
const app = createApp(config, database);
const server = createServer(app);
server.requestTimeout = 30_000;
server.headersTimeout = 15_000;
let stopping = false;
server.on('error', () => {
  console.error(JSON.stringify({ event: 'server.listen_failed' }));
  database.close();
  process.exitCode = 1;
});

server.listen(config.port, config.host, () => {
  console.log(JSON.stringify({
    event: 'server.started',
    address: `http://${config.host}:${config.port}`,
    mode: config.mode,
    setupRequired: !database.hasUsers(),
    manualPostingOnly: true,
  }));
});

function shutdown(signal: string): void {
  if (stopping) return;
  stopping = true;
  console.log(JSON.stringify({ event: 'server.stopping', signal }));
  server.close(() => {
    database.close();
    process.exit(0);
  });
  server.closeIdleConnections();
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
