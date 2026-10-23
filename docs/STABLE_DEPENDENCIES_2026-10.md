# Stable dependency qualification — 23 October 2026

The 32 original direct declarations were checked against official npm stable
metadata and pinned exactly. This includes Cheerio 1.2.0, dotenv 18.0.9,
express-rate-limit 8.7.1, Lucide 1.61.0, ESLint 10.13.0, jsdom 30.1.3,
Supertest 7.3.1, Vite 8.3.5, Vitest 5.0.5 and TypeScript 7.0.2. The transitive
ip-address package is updated to 10.7.4 for GHSA-rxp7-6hxx-x8q5. Node defaults
to 26.12.1, npm is 12.2.1, and the supported Node 24 line advances to 24.22.1.
Existing runtime-only PR #126 remains separate and must be reconciled before
either overlapping draft merges.

The compiled smoke exposed a public-document failure when the release path
has a hidden parent directory. A regression fixture reproduced HTTP 500 before
the fix. Serving the fixed `index.html` relative to the explicit public root
restores the public/admin/bearer entry documents while keeping dotfiles denied.
The regression and compiled persistence/authentication/worker/backup smoke
passed after the fix.

## Compiler and lint tooling

TypeScript 7 supplies the native application compiler. The current ESLint
TypeScript parser requires the JavaScript API and supports TypeScript below
6.1. Its independent `tools/lint` package and lock use the current stable 6.0.3
API. Run `npm run lint:install` after root `npm ci`. Lint rules are preserved;
there is no forced peer dependency bypass. Both dependency graphs are audited.
Google Maps ambient types are explicit for the TypeScript 7 frontend check.
This compatibility toolchain and the native compiler's bundled Go libraries
remain distinct from a claim that every development component is newest or
free of known vulnerabilities.

## Actual SQLite upgrade

The latest better-sqlite3 13.0.3 driver ships SQLite 3.53.4. The build script
downloads official SQLite 3.54.1 source, verifies its archive and amalgamation
SHA3-256 pins, preserves all 36 driver compile options, and compiles only this
checkout's native addon using pinned node-gyp 13.1.0. No shared interpreter,
toolchain or operator database is modified.

The upstream driver prefers shipped prebuilt binaries. After verifying the
new addon explicitly, the script removes its eight known obsolete prebuilds
from this owned dependency directory and verifies the normal loading path.
Actual versions, binary hash, source hashes and synthetic upgrade/backup
results are saved in `output/sqlite-build-verification.json`. CI requires an
actual 3.53.4 baseline, preserves a synthetic row across the upgrade, commits
a transaction, checks integrity and verifies a native backup. Application,
legacy database and backup entry points verify the engine in memory before
opening operator data. Real data migration requires its own approved backup
and rehearsal.

## Runtime acceptance

The container uses a digest-pinned current Node Alpine image, compiles the
same SQLite source for musl, removes unused npm/Yarn and retains UID 10001.
Every existing authentication, privacy, source-review, worker, migration,
backup, restart and compiled-smoke test remains required. Added gates check
actual installed versions on Linux and Windows, all advisory severities and
complete OS/runtime dependency inventory. Findings and suppressions fail the
gate; no scanner exclusion is added. Runtime reports and scans must be read
before claiming image acceptance.

The public UI's full rendered browser journey, provider authorization, live
TLS, the edge image's bundled dependencies, real backups/restoration and
Hetzner deployment remain separate acceptance work. This draft does not
deploy, merge, send messages, change billing or operate on live data.

Sources: [npm registry](https://registry.npmjs.org/),
[SQLite download](https://sqlite.org/download.html),
[better-sqlite3 custom builds](https://github.com/WiseLibs/better-sqlite3/blob/v13.0.3/docs/compilation.md),
[official Node image](https://hub.docker.com/_/node).
