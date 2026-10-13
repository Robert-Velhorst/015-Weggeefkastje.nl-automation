import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import request from 'supertest';
import { loadConfig } from '../src/config.js';
import { AppDatabase } from '../src/db/appDatabase.js';
import { createApp } from '../src/api/app.js';

const directories: string[] = [];
const databases: AppDatabase[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function harness() {
  const directory = mkdtempSync(join(tmpdir(), 'weggeef-public-api-'));
  directories.push(directory);
  mkdirSync(join(directory, 'dist-web'));
  writeFileSync(join(directory, 'dist-web', 'index.html'), '<!doctype html><title>Public test page</title>');
  const config = loadConfig({ NODE_ENV: 'test', APP_DATA_DIR: directory, DATABASE_PATH: join(directory, 'test.sqlite') }, directory);
  const database = new AppDatabase(config.databasePath);
  databases.push(database);
  const identity = database.bootstrapAdmin({ email: 'owner@example.nl', password: 'correct-horse-battery', displayName: 'Owner', workspaceName: 'Utrecht' });
  const source = database.createSource(identity.workspaceId, identity.userId, {
    key: 'official-map', name: 'Officiële kaart', accessMode: 'official_api', authorizationReference: 'approved-2026',
    attribution: 'Officiële kaart', publicationMode: 'automatic', enabled: true, allowsExactAddress: true,
  });
  const location = database.upsertVerifiedResidentLocation(identity.workspaceId, identity.userId, source, {
    sourceKey: 'official-map', title: 'Weggeefkastje bij de speeltuin', address: 'Voorbeeldstraat 10', postalCode: '1234AB', city: 'Utrecht',
    observedAt: '2026-09-04T10:00:00.000Z', evidenceSummary: 'Interne broninformatie die nooit openbaar mag worden.', status: 'active', categories: ['Boeken'],
  }, {
    addressLine: 'Voorbeeldstraat 10', postalCode: '1234AB', city: 'Utrecht', municipality: 'Utrecht', province: 'Utrecht',
    latitude: 52.0907, longitude: 5.1214, provider: 'pdok', verifiedAt: '2026-09-04T11:00:00.000Z',
  });
  return { database, app: createApp(config, database), location, workspaceId: identity.workspaceId };
}

describe('public resident locator API', () => {
  it('allows origin-restricted Google keys only on the public document, never leaking caretaker URLs', async () => {
    const { app } = harness();
    const publicPage = await request(app).get('/?category=Boeken').expect(200);
    expect(publicPage.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(publicPage.headers['content-security-policy']).toContain('https://*.googleapis.com');
    for (const path of ['/beheer', '/kastje-bijwerken/secret-token']) {
      const privatePage = await request(app).get(path).expect(200);
      expect(privatePage.headers['referrer-policy']).toBe('no-referrer');
      expect(privatePage.headers['content-security-policy']).not.toContain('googleapis.com');
    }
  });
  it('filters categories before counting and paginating, with OR semantics', async () => {
    const { app } = harness();
    const absent = await request(app).get('/api/public/locations').query({ category: 'Planten', limit: 1 }).expect(200);
    expect(absent.body.data).toMatchObject({ items: [], total: 0 });
    const present = await request(app).get('/api/public/locations').query({ category: ['Planten', 'Boeken'], limit: 1 }).expect(200);
    expect(present.body.data.total).toBe(1);
    expect(present.body.data.items[0].categories).toEqual(['Boeken']);
  });

  it('validates public filters instead of silently returning an unfiltered catalog', async () => {
    const { app } = harness();
    for (const query of ['category=Anything', 'page=NaN', 'limit=0', 'page=1.5', 'province=Atlantis']) {
      await request(app).get(`/api/public/locations?${query}`).expect(400);
    }
    const unknown = await request(app).get('/api/public/locations?category=unknown').expect(200);
    expect(unknown.body.data.total).toBe(0);
    const province = await request(app).get('/api/public/locations?province=Gelderland').expect(200);
    expect(province.body.data.total).toBe(0);
  });

  it('exports only matching public coordinates and attributions to My Maps, never private evidence', async () => {
    const { app } = harness();
    const map = await request(app).get('/api/public/map?category=Boeken').expect(200);
    expect(map.body.data).toMatchObject({ total: 1, truncated: false });
    expect(map.body.data.items[0]).toMatchObject({ latitude: 52.0907, longitude: 5.1214 });
    const exported = await request(app).get('/api/public/locations.kml?category=Boeken').expect(200);
    expect(exported.headers['content-type']).toContain('application/vnd.google-earth.kml+xml');
    const xml = exported.text ?? Buffer.from(exported.body).toString();
    expect(xml).toContain('<coordinates>5.1214,52.0907,0</coordinates>');
    expect(xml).toContain('Officiële kaart');
    expect(xml).not.toContain('Interne broninformatie');
    expect(xml).not.toContain('workspaceId');
    const empty = await request(app).get('/api/public/locations.kml?category=Planten').expect(200);
    expect(empty.text ?? Buffer.from(empty.body).toString()).not.toContain('<Placemark>');
  });

  it('returns only published exact locations without source evidence or authentication', async () => {
    const { app } = harness();

    const response = await request(app).get('/api/public/locations?query=Utrecht').expect(200);
    const attributions = await request(app).get('/api/public/attributions').expect(200);

    expect(response.body.data.items).toEqual([expect.objectContaining({
      addressLine: 'Voorbeeldstraat 10', postalCode: '1234AB', city: 'Utrecht', directionsUrl: expect.stringContaining('google.com/maps/dir'),
    })]);
    expect(JSON.stringify(response.body.data.items[0])).not.toContain('Interne broninformatie');
    expect(response.body.data.items[0]).not.toHaveProperty('sourceLink');
    expect(attributions.body.data).toEqual([{ name: 'Officiële kaart', attribution: 'Officiële kaart' }]);
    expect(JSON.stringify(attributions.body.data)).not.toContain('approved-2026');
  });

  it('queues a public report without removing the existing location', async () => {
    const { app, database, location, workspaceId } = harness();

    await request(app).post(`/api/public/locations/${location.id}/reports`)
      .send({ reason: 'Ik kan dit kastje niet meer vinden.' })
      .expect(202);

    expect(database.getResidentLocation(workspaceId, location.id)?.status).toBe('active');
    expect(database.listLocationUpdateRequests(workspaceId).items)
      .toContainEqual(expect.objectContaining({ locationId: location.id, requestType: 'public_report' }));
  });
});
