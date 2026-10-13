/** Import reviewed research as internal, append-only notes. Never changes publication or request status. */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { AppDatabase } from '../src/db/appDatabase.js';
import { verificationNoteSchema, type VerificationNoteInput } from '../src/domain/verificationNote.js';

const target = process.argv[2]; assert(target, 'Specify an existing database path');
const path = resolve(target); assert(existsSync(path), 'Database must already exist');
const base = JSON.parse(readFileSync('data/exports/osm-verification-2026-09-05/review-ledger.json', 'utf8'));
const further = JSON.parse(readFileSync('docs/research/2026-09-05-gouda-zeeland-verification.json', 'utf8'));
assert.equal(base.cases.length, 206); assert.equal(new Set(base.cases.map((c: any) => c.sourceRecordId)).size, 206);
assert.equal(further.cases.length, 13); assert.equal(new Set(further.cases.map((c: any) => c.sourceRecordId)).size, 13);
const baseById = new Map(base.cases.map((c: any) => [c.sourceRecordId, c]));
const outcome = (status: string): VerificationNoteInput['outcome'] => {
  if (status === 'published_address_correction') return 'address_corrected';
  if (/conflict|unresolved|multiple_house|not_currently|removal/.test(status)) return 'conflicting_evidence';
  if (/^exact_address_current|operator_corroboration/.test(status)) return 'corroborated';
  if (status === 'screening_only_exact_address_missing') return 'screened';
  return 'needs_evidence';
};
const area = (c: any): string => String(c.searchContextOnly?.weergavenaam ?? '').replace(/^.*?,\s*(?:\d{4}[A-Z]{2}\s+)?/, '').slice(0, 160);
const legacy = base.cases.map((c: any) => ({ sourceRecordId: c.sourceRecordId, input: verificationNoteSchema.parse({
  outcome: outcome(c.verification.status), findings: c.verification.note,
  remainingChecks: c.verification.status === 'published_address_correction'
    ? 'Adrescorrectie afgerond. Geen nieuwe fysieke controle; aanwezigheid, toegang en voorraad niet opnieuw bevestigd.'
    : 'Exact bezoekersadres, actuele aanwezigheid, toegankelijkheid en hergebruikstoestemming controleren voor zover nog niet aangetoond. Nabijgelegen BAG-adressen zijn uitsluitend zoekcontext.',
  searchArea: area(c), sourceUrls: [`https://www.openstreetmap.org/${c.sourceRecordId}`, ...(c.verification.corroboratingUrl ? [c.verification.corroboratingUrl] : [])], checkedAt: new Date(base.reviewedAt).toISOString(),
}) }));
const additions = further.cases.map((c: any) => {
  assert(baseById.has(c.sourceRecordId), 'Further research must match the original scoped candidates');
  return { sourceRecordId: c.sourceRecordId, input: verificationNoteSchema.parse({
    outcome: outcome(c.status), findings: c.note,
    remainingChecks: 'Hergebruikstoestemming is niet vastgesteld. Bevestig de koppeling met het kaartpunt, het exacte BAG-adres en actuele toegang. Bij tegenstrijdige of historische bronnen eerst actuele bevestiging vragen; niets automatisch publiceren.',
    searchArea: area(baseById.get(c.sourceRecordId)), sourceUrls: [...(c.corroboratingUrl ? [c.corroboratingUrl] : []), ...(c.additionalUrls ?? [])], checkedAt: new Date(further.checkedAt).toISOString(),
  }) };
});
// Optional reviewed rounds contain explicit note inputs; never infer a publication decision.
const additionalRoundPaths = process.argv.slice(3);
for (const roundPath of additionalRoundPaths) {
  const round = JSON.parse(readFileSync(roundPath, 'utf8'));
  assert(Array.isArray(round.cases) && round.cases.length > 0, 'Research round needs cases');
  assert.equal(new Set(round.cases.map((c: any) => c.sourceRecordId)).size, round.cases.length, 'Duplicate source IDs within research round');
  for (const c of round.cases) {
    assert(baseById.has(c.sourceRecordId), 'Research round must match original scoped candidates');
    additions.push({ sourceRecordId: c.sourceRecordId, input: verificationNoteSchema.parse(c.input) });
  }
}
const reader = new Database(path, { readonly: true });
const owners = reader.prepare("SELECT workspace_id, user_id FROM workspace_members WHERE role='owner'").all() as Array<{workspace_id: string; user_id: string}>;
assert.equal(owners.length, 1); const { workspace_id: workspaceId, user_id: actor } = owners[0];
const rows = reader.prepare("SELECT r.id, json_extract(r.candidate_json,'$.sourceRecordId') AS source_id FROM location_update_requests r JOIN source_registry s ON s.id=r.source_registry_id AND s.workspace_id=r.workspace_id WHERE r.workspace_id=? AND s.source_key='openstreetmap-nl-discovery'").all(workspaceId) as Array<{id: string; source_id: string}>;
const requests = new Map<string, string>();
for (const row of rows) { assert(!requests.has(row.source_id), 'Ambiguous source record to request mapping'); requests.set(row.source_id, row.id); }
for (const item of [...legacy, ...additions]) assert(requests.has(item.sourceRecordId), `Missing original request: ${item.sourceRecordId}`);
const beforeLocations = reader.prepare('SELECT * FROM resident_locations ORDER BY id').all();
const beforeRequests = reader.prepare('SELECT * FROM location_update_requests ORDER BY id').all();
const stamp = new Date().toISOString().replace(/[:.]/g, '-'); mkdirSync('data/backups', { recursive: true });
const backup = resolve(`data/backups/pre-verification-notes-${stamp}.sqlite`); await reader.backup(backup);
const database = new AppDatabase(path);
const count = () => (reader.prepare('SELECT COUNT(*) AS n FROM location_verification_notes').get() as {n: number}).n;
const beforeNotes = count();
for (const item of [...legacy, ...additions]) assert(database.addLocationVerificationNote(workspaceId, actor, requests.get(item.sourceRecordId)!, item.input, 'research-import-2026-09-05'));
assert.deepEqual(reader.prepare('SELECT * FROM resident_locations ORDER BY id').all(), beforeLocations);
assert.deepEqual(reader.prepare('SELECT * FROM location_update_requests ORDER BY id').all(), beforeRequests);
assert.equal(reader.pragma('integrity_check', { simple: true }), 'ok'); assert.deepEqual(reader.pragma('foreign_key_check'), []);
const report = { importedAt: new Date().toISOString(), database: path, backup, beforeNotes, afterNotes: count(), newNotes: count() - beforeNotes, originalRequestsUnchanged: true, originalLocationsUnchanged: true, researchedCandidates: 206, additionalResearch: additions.length, additionalRoundPaths };
const directory = 'data/exports/osm-verification-2026-09-05'; writeFileSync(`${directory}/notes-import-${stamp}.json`, JSON.stringify(report, null, 2), { flag: 'wx' });
console.log(JSON.stringify(report, null, 2)); database.close(); reader.close();
