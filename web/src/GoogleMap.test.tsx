// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { GoogleMap } from './GoogleMap';

it('loads only after consent, places coordinates, selects a cupboard and removes old markers', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key-not-valid');
  vi.stubEnv('VITE_GOOGLE_MAPS_MAP_ID', 'test-map-id');
  const markers: any[] = [];
  const selected: string[] = [];
  // Only the external Google boundary is simulated; the component/loader/lifecycle are real.
  class MapDouble { setCenter() {} setZoom() {} fitBounds() {} }
  class Bounds { extend() {} getCenter() { return { lat: 52.09, lng: 5.12 }; } }
  class Marker { map: unknown; position: unknown; click?: () => void; constructor(options: any) { this.map = options.map; this.position = options.position; markers.push(this); } addListener(_event: string, listener: () => void) { this.click = listener; } }
  vi.stubGlobal('google', { maps: { Map: MapDouble, LatLngBounds: Bounds, marker: { AdvancedMarkerElement: Marker }, event: { clearInstanceListeners: () => undefined } } });
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  const location = { id: 'cupboard-one', title: 'Testkastje', addressLine: 'Teststraat 12', city: 'Utrecht', postalCode: '1234AB', categories: ['Boeken'], latitude: 52.09, longitude: 5.12, lastVerifiedAt: '2026-09-05T10:00:00Z', directionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=52.09,5.12' };
  try {
    await act(async () => root.render(<GoogleMap locations={[location]} onSelect={(id) => selected.push(id)} />));
    expect(document.querySelector('script[src*="maps.googleapis.com"]')).toBeNull();
    await act(async () => container.querySelector('button')!.click());
    expect(document.querySelector('script[src*="maps.googleapis.com"]')).not.toBeNull();
    await act(async () => window.initWeggeefMap?.());
    expect(markers[0].position).toEqual({ lat: 52.09, lng: 5.12 });
    await act(async () => markers[0].click());
    expect(selected).toEqual(['cupboard-one']);
    await act(async () => root.render(<GoogleMap locations={[]} onSelect={(id) => selected.push(id)} />));
    expect(markers[0].map).toBeNull();
    await act(async () => window.gm_authFailure?.());
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('niet beschikbaar');
  } finally { await act(async () => root.unmount()); container.remove(); document.querySelector('script[src*="maps.googleapis.com"]')?.remove(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); }
});
