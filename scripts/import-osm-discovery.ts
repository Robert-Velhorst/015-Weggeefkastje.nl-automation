/** One-off, inspectable import of the saved NL Overpass snapshot. No social scraping. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import Database from 'better-sqlite3';
import { AppDatabase } from '../src/db/appDatabase.js';
import { createPdokAddressVerifier } from '../src/integrations/pdokAddress.js';
import { ingestResidentCandidate, type ResidentCandidateDraft } from '../src/services/residentCatalog.js';

const directory = resolve('data/exports/osm-discovery');
const snapshotText = readFileSync(`${directory}/snapshot.json`, 'utf8');
const snapshot = JSON.parse(snapshotText);
const digest = createHash('sha256').update(snapshotText).digest('hex');
const sourceKey = 'openstreetmap-nl-discovery';
const attribution = '© OpenStreetMap contributors — ODbL 1.0: https://opendatacommons.org/licenses/odbl/1-0/; adrescontrole: Kadaster/BAG via PDOK (Public Domain).';
const normalise = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
type Element = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags: Record<string, string> };
type Prepared = { candidate: ResidentCandidateDraft; reason?: string; excluded?: boolean; latitude?: number; longitude?: number };
const elements: Element[] = snapshot.data.elements;
assert(Array.isArray(elements) && elements.length > 0 && !snapshot.data.remark, 'Incomplete Overpass snapshot');
assert.equal(new Set(elements.map(e => `${e.type}/${e.id}`)).size, elements.length, 'Duplicate OSM object IDs');
assert.equal(snapshot.endpoint, 'https://overpass-api.de/api/interpreter');

function distance(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const rad = Math.PI / 180;
  const dLat = (a.latitude - b.latitude) * rad;
  const dLon = (a.longitude - b.longitude) * rad;
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2)));
}

function prepareElement(element: Element): Prepared {
  const t = element.tags;
  const recordId = `${element.type}/${element.id}`;
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  const categories: string[] = [];
  if (t.amenity === 'public_bookcase' || t.books && t.books !== 'no') categories.push('Boeken');
  if (t.fridge === 'yes') categories.push('Koelkast');
  if (t.plants && t.plants !== 'no' || /planten|stekjes/i.test(t.name ?? '')) categories.push('Planten');
  if (t.clothes && t.clothes !== 'no') categories.push('Kleding');
  // Food sharing alone does not prove shelf-stable food; never invent inventory.
  if (/houdbaar/i.test(t.description ?? '')) categories.push('Houdbare producten');
  if (/hygi[eë]ne|verzorging/i.test(t.description ?? '')) categories.push('Persoonlijke Hygiëne');
  const candidate: ResidentCandidateDraft = {
    sourceKey, sourceRecordId: recordId, sourceLink: `https://www.openstreetmap.org/${recordId}`,
    title: (t.name || (t.amenity === 'public_bookcase' ? 'Minibieb' : t.amenity === 'food_sharing' ? 'Voedseldeelpunt' : 'Weggeefkastje')).slice(0, 200),
    address: t['addr:street'] && t['addr:housenumber'] ? `${t['addr:street']} ${t['addr:housenumber']}` : undefined,
    postalCode: t['addr:postcode'], city: t['addr:city'], categories, status: 'active',
    observedAt: snapshot.retrievedAt,
    evidenceSummary: `${recordId}; amenity=${t.amenity}; OSM-coördinaten=${latitude},${longitude}; bron opgehaald ${snapshot.retrievedAt}; veldcontrole bron=${t.check_date || t['survey:date'] || 'onbekend'}; opening_hours=${t.opening_hours || 'onbekend'}; aanbod is geen voorraadcontrole.`.slice(0, 1000),
  };
  const closed = ['disused', 'abandoned', 'removed', 'demolished'].some(key => t[key] === 'yes' || Boolean(t[`${key}:amenity`])) || t.opening_hours === 'closed';
  const restricted = t.access && !['yes', 'permissive', 'public'].includes(t.access);
  if (restricted || closed || t.fee === 'yes') return { candidate, latitude, longitude, excluded: true, reason: restricted ? 'restricted_access' : closed ? 'closed_or_disused' : 'paid_access' };
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude! < 50 || latitude! > 54 || longitude! < 3 || longitude! > 8) return { candidate, excluded: true, reason: 'outside_nl_or_missing_coordinates' };
  return { candidate, latitude, longitude, reason: candidate.address ? undefined : 'exact_address_required' };
}

// Responses are saved for reproducible checks and to avoid repeat provider requests.
const cacheDir = `${directory}/pdok`;
mkdirSync(cacheDir, { recursive: true });
const cachedFetch: typeof fetch = async (input, init) => {
  const url = String(input);
  assert.equal(new URL(url).origin, 'https://api.pdok.nl');
  const path = `${cacheDir}/${createHash('sha256').update(url).digest('hex')}.json`;
  if (existsSync(path)) return new Response(readFileSync(path, 'utf8'), { status: 200, headers: { 'content-type': 'application/json' } });
  await delay(350);
  const response = await fetch(input, { ...init, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`PDOK ${response.status}; stopped instead of retrying aggressively`);
  const body = await response.text();
  JSON.parse(body);
  writeFileSync(path, body, { flag: 'wx' });
  return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
};

async function completeAddress(item: Prepared): Promise<void> {
  const c = item.candidate;
  if (!c.address || c.postalCode && c.city) return;
  const url = new URL('https://api.pdok.nl/bzk/locatieserver/search/v3_1/free');
  url.searchParams.set('q', [c.address, c.postalCode, c.city].filter(Boolean).join(' '));
  url.searchParams.set('fq', 'type:adres');
  url.searchParams.set('rows', '100');
  const payload = await (await cachedFetch(url)).json();
  // Only complete an already explicitly supplied street + house number. Never reverse-geocode a guessed house.
  const matches = (payload.response?.docs ?? []).filter((doc: any) => {
    const point = /^POINT\(([-.\d]+) ([-.\d]+)\)$/.exec(doc.centroide_ll ?? '');
    if (!point || !doc.straatnaam || doc.huisnummer == null || !doc.postcode || !doc.woonplaatsnaam) return false;
    const line = `${doc.straatnaam} ${doc.huisnummer}${doc.huisletter ?? ''}${doc.huisnummertoevoeging ?? ''}`;
    return normalise(c.address!) === normalise(line)
      && (!c.postalCode || normalise(c.postalCode) === normalise(doc.postcode))
      && (!c.city || normalise(c.city) === normalise(doc.woonplaatsnaam))
      && distance({ latitude: item.latitude!, longitude: item.longitude! }, { latitude: Number(point[2]), longitude: Number(point[1]) }) <= 100;
  });
  if (matches.length !== 1) { item.reason = 'address_enrichment_not_unique'; return; }
  c.postalCode = matches[0].postcode;
  c.city = matches[0].woonplaatsnaam;
}

const mode = process.argv[2];
if (mode === 'prepare') {
  const prepared: Prepared[] = [];
  const verifier = createPdokAddressVerifier({ baseUrl: 'https://api.pdok.nl', timeoutMs: 10000, fetchImpl: cachedFetch });
  for (const element of elements) {
    const item = prepareElement(element);
    if (!item.excluded && !item.reason) {
      await completeAddress(item);
      if (!item.reason && item.candidate.address && item.candidate.postalCode && item.candidate.city) {
        const verified = await verifier.verify({ address: item.candidate.address, postalCode: item.candidate.postalCode, city: item.candidate.city });
        if (!verified) item.reason = 'address_not_verified';
        else if (distance(verified, { latitude: item.latitude!, longitude: item.longitude! }) > 100) item.reason = 'source_address_coordinate_conflict';
      } else if (!item.reason) item.reason = 'exact_address_required';
    }
    prepared.push(item);
    if (prepared.length % 200 === 0) console.log(`Prepared ${prepared.length}/${elements.length}`);
  }
  const counts = prepared.reduce((out, item) => { const key = item.excluded ? 'excluded' : item.reason || 'ready'; out[key] = (out[key] || 0) + 1; return out; }, {} as Record<string, number>);
  writeFileSync(`${directory}/prepared.json`, JSON.stringify({ snapshotSha256: digest, preparedAt: new Date().toISOString(), counts, items: prepared }, null, 2));
  console.log(JSON.stringify(counts, null, 2));
} else if (mode === 'apply') {
  const target = process.argv[3];
  assert(target, 'Supply the exact database path to apply; no implicit production writes.');
  const path = resolve(target);
  assert(existsSync(path), 'Target must already exist; never bootstrap an accidental catalog.');
  const manifest = JSON.parse(readFileSync(`${directory}/prepared.json`, 'utf8'));
  assert.equal(manifest.snapshotSha256, digest, 'Prepared records must match immutable source');
  assert.equal(manifest.items.length, elements.length);
  const before = new Database(path, { readonly: true });
  const owners = before.prepare("SELECT m.workspace_id, m.user_id FROM workspace_members m JOIN users u ON u.id=m.user_id WHERE m.role='owner' AND u.disabled_at IS NULL").all() as Array<{ workspace_id: string; user_id: string }>;
  assert.equal(owners.length, 1, 'Choose workspace explicitly if there is more than one owner.');
  const { workspace_id: workspaceId, user_id: actorUserId } = owners[0];
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  mkdirSync('data/backups', { recursive: true });
  const backup = resolve(`data/backups/pre-osm-${stamp}.sqlite`);
  await before.backup(backup);
  before.close();
  const database = new AppDatabase(path); // Existing additive migrations, after backup.
  const reader = new Database(path, { readonly: true });
  let source = database.getSourceByKey(workspaceId, sourceKey);
  if (!source) source = database.createSource(workspaceId, actorUserId, {
    key: sourceKey, name: 'OpenStreetMap Nederland', accessMode: 'open_data',
    authorizationReference: 'ODbL 1.0 — https://www.openstreetmap.org/copyright; https://opendatacommons.org/licenses/odbl/1-0/',
    attribution, publicationMode: 'automatic', enabled: true, allowsExactAddress: true,
  });
  assert(source.enabled && source.allowsExactAddress && source.publicationMode === 'automatic', 'Existing source policy is not overridden.');
  const realVerifier = createPdokAddressVerifier({ baseUrl: 'https://api.pdok.nl', timeoutMs: 10000, fetchImpl: cachedFetch });
  const results: Array<Record<string, unknown>> = [];
  const startCount = (reader.prepare('SELECT COUNT(*) AS n FROM resident_locations').get() as { n: number }).n;
  for (const item of manifest.items as Prepared[]) {
    const candidate = item.candidate;
    if (item.excluded) { results.push({ id: candidate.sourceRecordId, disposition: 'excluded', reason: item.reason }); continue; }
    const pending = reader.prepare("SELECT id FROM location_update_requests WHERE workspace_id=? AND source_registry_id=? AND json_extract(candidate_json, '$.sourceRecordId')=? AND json_extract(candidate_json, '$.observedAt')=? LIMIT 1")
      .get(workspaceId, source.id, candidate.sourceRecordId, candidate.observedAt) as { id: string } | undefined;
    if (pending) { results.push({ id: candidate.sourceRecordId, disposition: 'existing_review', requestId: pending.id }); continue; }
    if (item.reason) {
      const request = database.queueLocationUpdateRequest(workspaceId, { requestType: 'candidate', reason: item.reason, sourceRegistryId: source.id, candidate }, actorUserId);
      results.push({ id: candidate.sourceRecordId, disposition: 'review', reason: item.reason, requestId: request.id });
    } else {
      const result = await ingestResidentCandidate({ database, verifier: realVerifier }, { workspaceId, actorUserId, candidate });
      results.push({ id: candidate.sourceRecordId, disposition: result.disposition, locationId: 'location' in result ? result.location?.id : undefined });
    }
  }
  const endCount = (reader.prepare('SELECT COUNT(*) AS n FROM resident_locations').get() as { n: number }).n;
  const counts = results.reduce((out, result) => { const key = String(result.disposition); out[key] = (out[key] || 0) + 1; return out; }, {} as Record<string, number>);
  database.recordSourceCheck(workspaceId, source.id, `Snapshot ${elements.length}; ${endCount - startCount} new; ${counts.review || 0} review`);
  const report = { importedAt: new Date().toISOString(), databasePath: path, backup, snapshotSha256: digest, workspaceId, startCount, endCount, counts, results };
  writeFileSync(`${directory}/import-${stamp}.json`, JSON.stringify(report, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ backup, startCount, endCount, counts }, null, 2));
  reader.close(); database.close();
} else throw new Error('Usage: npx tsx scripts/import-osm-discovery.ts prepare | apply <existing-database-path>');
