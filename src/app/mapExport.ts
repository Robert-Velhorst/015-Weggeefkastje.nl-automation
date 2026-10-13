import type { PublicResidentLocation } from '../domain/residentLocation.js';

function xml(value: string): string {
  // XML 1.0 forbids these control characters even when escaped as entities.
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!);
}

/** A dated, public-only snapshot; never a live inventory or a Google account mutation. */
export function buildPublicKml(locations: PublicResidentLocation[], attributions: Array<{ name: string; attribution: string }>, createdAt = new Date().toISOString()): string {
  const sources = attributions.map((source) => `${source.name}: ${source.attribution}`).join('; ');
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
<name>Weggeefkastje.nl</name>
<description>${xml(`Momentopname: ${createdAt}. Categorieën beschrijven gebruikelijk aanbod, geen actuele voorraad. Bronnen: ${sources}`)}</description>
${locations.map((location) => `<Placemark>
<name>${xml(location.title)}</name>
<description>${xml(`${location.addressLine}, ${location.postalCode} ${location.city}\nGebruikelijk aanbod: ${location.categories.join(', ') || 'Niet bekend'}\nGecontroleerd: ${location.lastVerifiedAt}\nRoute: ${location.directionsUrl}\nBronnen: ${sources}`)}</description>
<ExtendedData><Data name="id"><value>${xml(location.id)}</value></Data><Data name="aanbod"><value>${xml(location.categories.join(', ') || 'Niet bekend')}</value></Data></ExtendedData>
<Point><coordinates>${location.longitude},${location.latitude},0</coordinates></Point>
</Placemark>`).join('\n')}
</Document></kml>`;
}
