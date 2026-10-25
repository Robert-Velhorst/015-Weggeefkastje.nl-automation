# Stable dependency and runtime proposal - 25 October 2026

This proposal consolidates the runtime/dependency work from earlier drafts
#125, #126 and #127 while preserving every current-main test file, fixture and
assertion byte. No new application case is added. The earlier drafts remain
available for comparison; their green checks do not qualify this new head.

A fresh official npm-registry review confirms all 32 application declarations
remain at their highest public stable releases, including Vite 8.3.5, which
addresses the open Vite advisory. Node defaults to 26.12.1; the supported Node
24 line is 24.22.1. The package manager is npm 12.2.1.

TypeScript 7.0.2 is the application compiler. The independent lint workspace
uses the stable TypeScript 6.0.3 JavaScript API because the current ESLint parser
cannot consume the TypeScript 7 native compiler API. This is an explicit gap
against the independently highest-version requirement; no forced peer override
or rule relaxation is used. Both locked dependency graphs are audited.

## Actual database engine

The native driver remains better-sqlite3 13.0.3. Its default SQLite 3.53.4 engine
is rebuilt from official SQLite 3.54.1 source with checked archive/amalgamation
SHA3 pins and the same 36 driver compile options. The build uses only the owned
checkout and a synthetic temporary database. It checks preserved rows, a
transaction, integrity and a native backup across the synthetic engine upgrade.

Every database entry point verifies the engine in memory before opening operator
data. This proposal does not migrate a real database; deployment requires its
own approved backup, restore rehearsal, ownership and rollback verification.

## Source and image qualification

Every existing Linux/Windows command, original case, lint/type check, compiled
bootstrap, authentication/persistence/worker/backup smoke and reverse-proxy
configuration check remains required. Exact source/case identities are recorded
before installation. Native builds and application execution take place only on
disposable hosted workers during qualification.

The final production filesystem starts from pinned clean Alpine 3.24.3 and
copies the identical Node executable from the pinned official Node image. Build
package managers and the compiler are not copied from that source image into
any final runtime layer. Code/dependencies are root-owned; only the data directory
is writable by UID 10001. Existing volumes are not changed by a build.

CI preserves the complete saved image, descriptor/configuration chain, all
runtime layer bytes, actual Node/SQLite identity and full package/vulnerability
inventory. Every advisory severity is required, with no ignore file or language
DB skip. Hosted results are pending for this new head. A clean runtime report
would not establish clean SDK/compiler, upstream vendor-suite, browser/provider,
real-data backup/restoration or live deployment acceptance.

No main merge, manual deployment, provider/DNS/billing/permission change or
operator-data mutation is included.
