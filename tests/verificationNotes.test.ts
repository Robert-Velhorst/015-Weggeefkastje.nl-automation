import { afterEach, expect, it } from 'vitest';
import request from 'supertest';
import { AppDatabase } from '../src/db/appDatabase.js';
import { createApp } from '../src/api/app.js';
import { loadConfig } from '../src/config.js';

const databases: AppDatabase[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));
function harness() {
  const database = new AppDatabase(':memory:'); databases.push(database);
  const identity = database.bootstrapAdmin({ email: 'review@example.nl', password: 'correct-horse-battery', displayName: 'Reviewer', workspaceName: 'Test' });
  const auth = database.createSession(identity.userId, identity.workspaceId, 1);
  const app = createApp(loadConfig({ NODE_ENV: 'test' }), database);
  const candidate = database.queueLocationUpdateRequest(identity.workspaceId, { requestType: 'candidate', reason: 'exact_address_required', candidate: { title: 'Testkastje', sourceRecordId: 'node/test' } });
  return { database, app, identity, candidate, cookie: `wk_session=${auth.token}`, csrf: auth.context.csrfToken };
}
const note = { outcome: 'needs_evidence', findings: 'Alleen een kaartpunt gevonden.', remainingChecks: 'Exact adres en toegankelijkheid bevestigen.', sourceUrls: ['https://example.nl/kastje'], checkedAt: '2026-09-05T06:00:00.000Z', searchArea: 'Gouda' };

it('persists evidence notes and history without resolving or publishing the candidate', async () => {
  const h = harness();
  const url = `/api/location-update-requests/${h.candidate.id}/verification-notes`;
  await request(h.app).post(url).set('Cookie', h.cookie).set('x-csrf-token', h.csrf).send(note).expect(201);
  await request(h.app).post(url).set('Cookie', h.cookie).set('x-csrf-token', h.csrf).send(note).expect(201);
  await request(h.app).post(url).set('Cookie', h.cookie).set('x-csrf-token', h.csrf).send({ ...note, findings: 'Tweede bron gevonden.' }).expect(201);
  const response = await request(h.app).get('/api/location-update-requests?query=Gouda').set('Cookie', h.cookie).expect(200);
  expect(response.body.data.total).toBe(1);
  expect(response.body.data.items[0].verificationNotes.map((n: any) => n.findings)).toEqual(['Tweede bron gevonden.', note.findings]);
  expect(h.database.getLocationUpdateRequest(h.identity.workspaceId, h.candidate.id)?.status).toBe('pending');
  expect(h.database.listPublicResidentLocations(h.identity.workspaceId, {}).total).toBe(0);
});

it('keeps notes scoped to the workspace and blocks viewer writes', async () => {
  const h = harness(); const raw = (h.database as any).db;
  raw.prepare('INSERT INTO workspaces(id,name,created_at,updated_at) VALUES(?,?,?,?)').run('other-workspace', 'Other', note.checkedAt, note.checkedAt);
  const foreign = h.database.queueLocationUpdateRequest('other-workspace', { requestType: 'candidate', reason: 'exact_address_required', candidate: { title: 'Foreign private candidate' } });
  await request(h.app).post(`/api/location-update-requests/${foreign.id}/verification-notes`).set('Cookie', h.cookie).set('x-csrf-token', h.csrf).send(note).expect(404);
  const listed = await request(h.app).get('/api/location-update-requests').set('Cookie', h.cookie).expect(200);
  expect(listed.body.data.total).toBe(1);
  raw.prepare("UPDATE workspace_members SET role='viewer' WHERE workspace_id=? AND user_id=?").run(h.identity.workspaceId, h.identity.userId);
  await request(h.app).post(`/api/location-update-requests/${h.candidate.id}/verification-notes`).set('Cookie', h.cookie).set('x-csrf-token', h.csrf).send(note).expect(403);
});

it('paginates beyond 100 requests and filters before counting', async () => {
  const h = harness();
  for (let i = 0; i < 105; i++) h.database.queueLocationUpdateRequest(h.identity.workspaceId, { requestType: 'candidate', reason: 'exact_address_required', candidate: { title: `Gouda ${i}` } });
  const response = await request(h.app).get('/api/location-update-requests?query=Gouda&page=5&limit=25').set('Cookie', h.cookie).expect(200);
  expect(response.body.data).toMatchObject({ total: 105, page: 5, limit: 25 });
  expect(response.body.data.items).toHaveLength(5);
  for (const query of ['page=0', 'page=no', 'limit=101']) await request(h.app).get(`/api/location-update-requests?${query}`).set('Cookie', h.cookie).expect(400);
});

it('rejects unauthenticated, csrf-less, foreign-workspace and unsafe-link notes', async () => {
  const h = harness(); const other = harness();
  const url = `/api/location-update-requests/${h.candidate.id}/verification-notes`;
  await request(h.app).post(url).send(note).expect(401);
  await request(h.app).post(url).set('Cookie', h.cookie).send(note).expect(403);
  await request(h.app).post(`/api/location-update-requests/${other.candidate.id}/verification-notes`).set('Cookie', h.cookie).set('x-csrf-token', h.csrf).send(note).expect(404);
  await request(h.app).post(url).set('Cookie', h.cookie).set('x-csrf-token', h.csrf).send({ ...note, sourceUrls: ['javascript:alert(1)'] }).expect(400);
  expect(h.database.listLocationUpdateRequests(h.identity.workspaceId).items[0].verificationNotes ?? []).toHaveLength(0);
});
