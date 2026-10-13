// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResidentApp } from './ResidentApp';

let root: Root;
let container: HTMLDivElement;
const location = { id: 'test-cupboard', title: 'Testkastje', addressLine: 'Teststraat 12', postalCode: '1234AB', city: 'Utrecht', latitude: 52.09, longitude: 5.12, categories: ['Boeken'], lastVerifiedAt: '2026-09-04T10:00:00Z', directionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=52.09,5.12' };
const calls: string[] = [];

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  window.history.replaceState({}, '', '/');
  calls.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    calls.push(input);
    const url = new URL(input, 'https://local.test');
    if (url.pathname.endsWith('/attributions')) return new Response(JSON.stringify({ data: [{ name: 'OpenStreetMap Nederland', attribution: '© OpenStreetMap contributors — ODbL 1.0' }] }));
    if (url.pathname.endsWith('/reports')) return new Response(JSON.stringify({ data: { received: true } }), { status: 202 });
    const items = url.searchParams.has('category') ? [] : [location];
    return new Response(JSON.stringify({ data: { items, total: items.length, page: 1, limit: 12, truncated: false } }));
  }));
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => document.querySelector('script[src*="maps.googleapis.com"]')?.dispatchEvent(new Event('error')));
  await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
});
async function render() { await act(async () => root.render(<ResidentApp />)); }
function button(label: string) { return Array.from(container.querySelectorAll('button')).find((node) => node.textContent?.trim() === label)!; }

describe('resident website', () => {
  it('shows the data licence next to results and labels address verification precisely', async () => {
    await render();
    const credit = container.querySelector('[aria-label="Licentie locatiegegevens"]');
    expect(credit?.textContent).toContain('OpenStreetMap');
    expect(credit?.closest('details')).toBeNull();
    expect(credit?.querySelector('a')?.href).toBe('https://www.openstreetmap.org/copyright');
    expect(container.textContent).toContain('Adres gecontroleerd op');
    expect(container.textContent).not.toContain('Laatst gecontroleerd op');
  });
  it('keeps the map open across a filter request instead of asking for consent again', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key-not-valid');
    vi.stubEnv('VITE_GOOGLE_MAPS_MAP_ID', 'test-map-id');
    await render();
    await act(async () => button('Kaart').click());
    await act(async () => button('Google Maps openen').click());
    expect(button('Google Maps openen')).toBeUndefined();
    await act(async () => button('Planten').click());
    expect(button('Google Maps openen')).toBeUndefined();
    // Reject the external script in this no-network test; do not leave its timer alive.
    await act(async () => document.querySelector('script[src*="maps.googleapis.com"]')?.dispatchEvent(new Event('error')));
  });
  it('filters the catalog, keeps filters in the URL, and restores them on back navigation', async () => {
    await render();
    expect(container.textContent).toContain('Teststraat 12');
    expect(button('Planten')).toBeDefined();
    await act(async () => button('Planten').click());
    expect(window.location.search).toContain('category=Planten');
    expect(container.textContent).not.toContain('Teststraat 12');
    expect(calls.some((call) => call.includes('category=Planten'))).toBe(true);
    await act(async () => { window.history.replaceState({}, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')); });
    expect(container.textContent).toContain('Teststraat 12');
  });
  it('provides map and installation paths without loading Google on page load', async () => {
    await render();
    expect(document.querySelector('script[src*="maps.googleapis.com"]')).toBeNull();
    expect(button('Kaart')).toBeDefined();
    await act(async () => button('Kaart').click());
    expect(container.textContent).toContain('Google Maps');
    expect(container.querySelector('a[href="#app"]')).not.toBeNull();
    expect(container.querySelector('a[href*="locations.kml"]')).not.toBeNull();
    expect(document.querySelector('script[src*="maps.googleapis.com"]')).toBeNull();
  });
  it('shows an error and recovers without inventing locations', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('Network unavailable'); }));
    await render();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.textContent).not.toContain('Teststraat 12');
    expect(button('Opnieuw proberen')).toBeDefined();
  });
});
