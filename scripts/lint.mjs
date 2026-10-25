import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const requireLint = createRequire(new URL('../tools/lint/package.json', import.meta.url));
const cli = join(dirname(requireLint.resolve('eslint/package.json')), 'bin/eslint.js');
const child = spawnSync(process.execPath, [cli, '.'], { cwd: fileURLToPath(new URL('../', import.meta.url)), stdio: 'inherit' });
if (child.error) throw child.error;
process.exitCode = child.status ?? 1;
