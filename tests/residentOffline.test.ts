import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

describe('resident app offline safety', () => {
  it('falls back only for public navigation and never caches API, caretaker or admin responses', async () => {
    const listeners: Record<string, (event: any) => void> = {};
    const offline = new Response('Offline, reconnect to search');
    const cached: string[] = [];
    const source = readFileSync(new URL('../web/public/sw.js', import.meta.url), 'utf8');
    runInNewContext(source, {
      self: { location: { origin: 'https://test.local' }, addEventListener: (event: string, callback: (event: any) => void) => { listeners[event] = callback; } },
      URL, Response, fetch: async () => { throw new Error('offline'); },
      caches: { match: async (key: string) => { cached.push(key); return offline; } },
    });
    for (const path of ['/api/public/locations', '/api/public/caretaker/secret', '/beheer', '/kastje-bijwerken/secret', 'https://maps.googleapis.com/maps/api/js']) {
      let handled = false;
      listeners.fetch({ request: { url: new URL(path, 'https://test.local').href, method: 'GET', mode: 'navigate' }, respondWith: () => { handled = true; } });
      expect(handled).toBe(false);
    }
    let response: Promise<Response> | undefined;
    listeners.fetch({ request: { url: 'https://test.local/?view=map', method: 'GET', mode: 'navigate' }, respondWith: (value: Promise<Response>) => { response = value; } });
    expect(await (await response)!.text()).toContain('Offline');
    expect(cached).toEqual(['/offline.html']);
  });
});
