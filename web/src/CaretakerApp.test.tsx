// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { CaretakerApp } from './CaretakerApp';

it('lets the owner update usual categories while preserving existing unrecognized labels', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  window.history.replaceState({}, '', '/kastje-bijwerken/test-token');
  let submitted: any;
  const location = { id: 'test', title: 'Testkastje', addressLine: 'Teststraat 12', postalCode: '1234AB', city: 'Utrecht', status: 'active', categories: ['Boeken', 'Lokale specialiteit'], lastVerifiedAt: '2026-09-05T10:00:00Z' };
  vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
    if (init?.method === 'POST') submitted = JSON.parse(init.body);
    return new Response(JSON.stringify({ data: { ...location, ...(submitted ?? {}) } }));
  }));
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<CaretakerApp />));
    const plant = container.querySelector<HTMLInputElement>('input[type="checkbox"][value="Planten"]');
    expect(plant).not.toBeNull();
    await act(async () => plant!.click());
    await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(submitted.categories).toEqual(['Boeken', 'Lokale specialiteit', 'Planten']);
    expect(container.querySelector('[role="status"]')?.textContent).toContain('opgeslagen');
  } finally { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); }
});
