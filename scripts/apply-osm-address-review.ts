/** Bounded operational correction: two reviewed OSM/BAG address spellings, no guessed houses. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { AppDatabase } from '../src/db/appDatabase.js';
import { createPdokAddressVerifier } from '../src/integrations/pdokAddress.js';
import { ingestResidentCandidate, type ResidentCandidateDraft } from '../src/services/residentCatalog.js';

const target = process.argv[2];
assert(target, 'Specify an existing database; no implicit production target');
const path = resolve(target);
assert(existsSync(path));
const directory = resolve('data/exports/osm-verification-2026-09-05');
const prepared = JSON.parse(readFileSync('data/exports/osm-discovery/prepared.json', 'utf8'));
const snapshot = readFileSync('data/exports/osm-discovery/snapshot.json', 'utf8');
assert.equal(prepared.snapshotSha256, createHash('sha256').update(snapshot).digest('hex'));
const corrections = [
  { id: 'node/12615194476', before: { address: 'Professor Leonard Fuchslaan 27', postalCode: '3571HD', city: 'Utrecht' }, after: { address: 'Prof. Leonard Fuchslaan 27', postalCode: '3571HD', city: 'Utrecht' }, explanation: 'Officiele straatnaamafkorting Professor -> Prof.; huisnummer en postcode ongewijzigd.' },
  { id: 'node/13128873926', before: { address: "'t Zand 34", postalCode: '3454PB', city: 'Utrecht' }, after: { address: "'t Zand 34", postalCode: '3454PB', city: 'De Meern' }, explanation: 'BAG-woonplaats De Meern i.p.v. gemeentenaam Utrecht; straat, huisnummer en postcode ongewijzigd.' },
];
const cacheDir = `${directory}/verified-addresses`;
mkdirSync(cacheDir, { recursive: true });
const cachedFetch: typeof fetch = async (input, init) => {
  const url = String(input);
  assert.equal(new URL(url).origin, 'https://api.pdok.nl');
  const file = `${cacheDir}/${createHash('sha256').update(url).digest('hex')}.json`;
  if (existsSync(file)) {
    const saved = JSON.parse(readFileSync(file, 'utf8'));
    assert.equal(saved.url, url);
    return new Response(saved.body, { status: 200 });
  }
  const response = await fetch(input, { ...init, signal: AbortSignal.timeout(10000) });
  assert(response.ok, `PDOK ${response.status}`);
  const body = await response.text();
  JSON.parse(body);
  writeFileSync(file, JSON.stringify({ url, retrievedAt: new Date().toISOString(), body }), { flag: 'wx' });
  return new Response(body, { status: 200 });
};
const verifier = createPdokAddressVerifier({ baseUrl: 'https://api.pdok.nl', timeoutMs: 10000, fetchImpl: cachedFetch });
const ready = [];
for (const correction of corrections) {
  const item = prepared.items.find((i: any) => i.candidate.sourceRecordId === correction.id);
  assert(item && item.reason === 'address_not_verified');
  for (const key of ['address', 'postalCode', 'city'] as const) assert.equal(item.candidate[key], correction.before[key]);
  const verified = await verifier.verify(correction.after);
  assert(verified, `Exact BAG verification failed for ${correction.id}`);
  const rad = Math.PI / 180;
  const meters = 6371000 * 2 * Math.asin(Math.sqrt(Math.sin((verified.latitude - item.latitude) * rad / 2) ** 2 + Math.cos(item.latitude * rad) * Math.cos(verified.latitude * rad) * Math.sin((verified.longitude - item.longitude) * rad / 2) ** 2));
  assert(meters < 50, 'Corrected exact address must remain close to the original OSM point');
  const candidate: ResidentCandidateDraft = { ...item.candidate, ...correction.after,
    evidenceSummary: `${item.candidate.evidenceSummary} Adresreview 2026-09-05: ${correction.explanation} BAG afstand ${Math.round(meters)}m. Geen nieuwe fysieke controle.` };
  assert(candidate.evidenceSummary!.length <= 1000);
  ready.push({ correction, candidate, meters });
}

const reader = new Database(path, { readonly: true });
const owners = reader.prepare("SELECT workspace_id, user_id FROM workspace_members WHERE role='owner'").all() as Array<{workspace_id: string; user_id: string}>;
assert.equal(owners.length, 1);
const { workspace_id: workspaceId, user_id: actorUserId } = owners[0];
const beforeRows = reader.prepare('SELECT * FROM resident_locations ORDER BY id').all() as any[];
const beforePending = (reader.prepare("SELECT COUNT(*) AS n FROM location_update_requests WHERE status='pending'").get() as any).n;
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
mkdirSync('data/backups', { recursive: true });
const backup = resolve(`data/backups/pre-address-review-${stamp}.sqlite`);
await reader.backup(backup);
const database = new AppDatabase(path);
const results = [];
for (const item of ready) {
  const result = await ingestResidentCandidate({ database, verifier }, { workspaceId, actorUserId, candidate: item.candidate });
  assert(['published', 'duplicate'].includes(result.disposition), `Unexpected disposition ${result.disposition}`);
  const requests = reader.prepare("SELECT id FROM location_update_requests WHERE workspace_id=? AND status='pending' AND json_extract(candidate_json,'$.sourceRecordId')=?").all(workspaceId, item.correction.id) as Array<{id: string}>;
  for (const request of requests) assert(database.resolveLocationUpdateRequest(workspaceId, actorUserId, request.id, 'resolved', 'osm-address-review-2026-09-05'));
  results.push({ sourceRecordId: item.correction.id, disposition: result.disposition, resolvedRequests: requests.map(r => r.id), locationId: 'location' in result ? result.location?.id : undefined, before: item.correction.before, after: item.correction.after, bagDistanceMeters: item.meters });
}
for (const row of beforeRows) assert.deepEqual(reader.prepare('SELECT * FROM resident_locations WHERE id=?').get(row.id), row, 'Existing location changed');
assert.equal(reader.pragma('integrity_check', { simple: true }), 'ok');
assert.deepEqual(reader.pragma('foreign_key_check'), []);
const afterCount = (reader.prepare('SELECT COUNT(*) AS n FROM resident_locations').get() as any).n;
const afterPending = (reader.prepare("SELECT COUNT(*) AS n FROM location_update_requests WHERE status='pending'").get() as any).n;
assert.equal(afterCount - beforeRows.length, results.filter(r => r.disposition === 'published').length);
assert.equal(beforePending - afterPending, results.reduce((sum, r) => sum + r.resolvedRequests.length, 0));
const report = { checkedAt: new Date().toISOString(), databasePath: path, backup, beforeCount: beforeRows.length, afterCount, beforePending, afterPending, originalLocationsUnchanged: true, integrity: 'ok', results };
writeFileSync(`${directory}/applied-${stamp}.json`, JSON.stringify(report, null, 2), { flag: 'wx' });
console.log(JSON.stringify(report, null, 2));
reader.close(); database.close();
