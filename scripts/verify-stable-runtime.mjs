import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
const args = process.argv.slice(2);
assert.ok(args.length === 0 || (args.length === 1 && args[0] === '--container'));
assert.ok(['24.22.1','26.12.1'].includes(process.versions.node));
if (args.length) { assert.equal(process.versions.node, '26.12.1'); assert.equal(process.platform, 'linux'); assert.equal(process.getuid(), 10001); }
const database = new Database(':memory:');
let sqlite;
try {
  sqlite = database.prepare('SELECT sqlite_version() AS version').get().version;
  assert.equal(sqlite, '3.54.1');
  assert.equal(database.pragma('integrity_check', {simple:true}), 'ok');
} finally { database.close(); }
console.log(JSON.stringify({node:process.versions.node,openssl:process.versions.openssl,sqlite,platform:process.platform,arch:process.arch,uid:process.getuid?.(),operatorDataTouched:false}));
