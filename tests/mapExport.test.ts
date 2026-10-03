import { describe, expect, it } from 'vitest';
import { buildPublicKml } from '../src/app/mapExport.js';

describe('My Maps XML boundary', () => {
  it('escapes untrusted labels, excludes XML control characters and preserves exact coordinates', () => {
    const exported = buildPublicKml([{ id: 'id', title: '<script>not executable</script> & "kastje"\u0001', addressLine: 'Straat 12', postalCode: '1234AB', city: 'Utrecht', latitude: 52.09, longitude: 5.12, categories: ['Boeken'], directionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=52.09,5.12', lastVerifiedAt: '2026-09-05T10:00:00Z' }], [{ name: 'Bron', attribution: '<b>Attribution</b>' }], '2026-09-05T11:00:00Z');
    expect(exported).not.toContain('<script>');
    expect(exported).not.toContain('\u0001');
    expect(exported).toContain('&lt;script&gt;not executable&lt;/script&gt; &amp; &quot;kastje&quot;');
    expect(exported).toContain('<coordinates>5.12,52.09,0</coordinates>');
    expect(exported).toContain('2026-09-05T11:00:00Z');
    expect(exported).toContain('&lt;b&gt;Attribution&lt;/b&gt;');
  });
});
