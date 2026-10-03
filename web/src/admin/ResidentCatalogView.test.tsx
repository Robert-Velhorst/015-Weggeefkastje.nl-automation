// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { ResidentCatalogView } from './ResidentCatalogView';

it('shows candidate evidence, real totals, and can reach the next review page', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const note = { id: 'n', outcome: 'conflicting_evidence', findings: 'Bron noemt een ander huisnummer.', remainingChecks: 'Bezoekersadres bevestigen.', sourceUrls: ['https://example.nl/bron'], searchArea: 'Gouda', checkedAt: '2026-09-05T06:00:00Z', createdAt: '2026-09-05T06:00:00Z' };
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify({ data: url.startsWith('/api/resident-locations') ? { items: [], total: 0 } : { items: [{ id: 'r', requestType: 'candidate', status: 'pending', reason: 'exact_address_required', createdAt: note.checkedAt, candidate: { title: url.includes('page=2') ? 'Tweede pagina' : 'Onderzocht kastje', sourceLink: 'https://example.nl/osm', evidenceSummary: 'Oorspronkelijke waarneming' }, verificationNotes: [note] }], total: 1862, page: url.includes('page=2') ? 2 : 1, limit: 25 } }))));
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
  try {
    await act(async () => root.render(<ResidentCatalogView />));
    expect(container.textContent).toContain('Onderzocht kastje');
    expect(container.textContent).toContain('1862');
    expect(container.textContent).toContain(note.remainingChecks);
    expect(container.querySelector('a[href="https://example.nl/bron"]')).not.toBeNull();
    const next = [...container.querySelectorAll('button')].find(b => b.textContent === 'Volgende');
    expect(next?.disabled).toBe(false);
    await act(async () => next!.click());
    expect(container.textContent).toContain('Tweede pagina');
  } finally { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); }
});

it('saves an operator note and displays returned history without publishing', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  let saved: any; const paths: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') { paths.push(url); saved = JSON.parse(String(init.body)); return new Response(JSON.stringify({ data: { ...saved, id: 'n', createdAt: saved.checkedAt } })); }
    return new Response(JSON.stringify({ data: url.startsWith('/api/resident-locations') ? { items: [], total: 0 } : { items: [{ id: 'request-1', requestType: 'candidate', status: 'pending', reason: 'exact_address_required', createdAt: '2026-09-05T06:00:00Z', candidate: { title: 'Testkastje' }, verificationNotes: saved ? [{ ...saved, id: 'n', createdAt: saved.checkedAt }] : [] }], total: 1, page: 1, limit: 25 } }));
  }));
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
  try {
    await act(async () => root.render(<ResidentCatalogView canWrite />));
    (container.querySelector('[name="findings"]') as HTMLTextAreaElement).value = 'Bron bevestigt de straat.';
    (container.querySelector('[name="remainingChecks"]') as HTMLTextAreaElement).value = 'Huisnummer nog onbekend.';
    (container.querySelector('[name="sourceUrls"]') as HTMLTextAreaElement).value = 'https://example.nl/kastje';
    await act(async () => container.querySelector('.verification-edit form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(paths).toEqual(['/api/location-update-requests/request-1/verification-notes']);
    expect(saved).toMatchObject({ findings: 'Bron bevestigt de straat.', remainingChecks: 'Huisnummer nog onbekend.', sourceUrls: ['https://example.nl/kastje'] });
    expect(container.querySelector('.verification-note')?.textContent).toContain('Huisnummer nog onbekend.');
  } finally { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); }
});
