import { useEffect, useRef, useState } from 'react';
import { MapPin, ShieldCheck } from 'lucide-react';
import type { PublicLocation } from './api';

declare global { interface Window { initWeggeefMap?: () => void; gm_authFailure?: () => void } }
let sdk: Promise<void> | undefined;
function loadMaps(key: string): Promise<void> {
  if (sdk) return sdk;
  sdk = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    const timeout = window.setTimeout(() => fail(), 15000);
    const fail = () => { window.clearTimeout(timeout); script.remove(); sdk = undefined; reject(new Error('Google Maps kon niet worden geladen.')); };
    window.initWeggeefMap = () => { window.clearTimeout(timeout); resolve(); };
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?${new URLSearchParams({ key, v: 'quarterly', loading: 'async', callback: 'initWeggeefMap', libraries: 'marker', language: 'nl', region: 'NL', auth_referrer_policy: 'origin' })}`;
    script.onerror = fail;
    document.head.append(script);
  });
  return sdk;
}

export function GoogleMap({ locations, onSelect }: { locations: PublicLocation[]; onSelect: (id: string) => void }) {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();
  const mapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID?.trim();
  const configured = Boolean(key && mapId);
  const [allowed, setAllowed] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const select = useRef(onSelect);
  select.current = onSelect;

  useEffect(() => {
    if (!allowed || !key || !mapId) return;
    let active = true;
    const authenticationFailed = () => { if (active) setError('Google Maps is niet beschikbaar. Je kunt de kastjes wel in de lijst bekijken.'); };
    window.gm_authFailure = authenticationFailed;
    loadMaps(key).then(() => {
      if (!active || !container.current) return;
      map.current = new google.maps.Map(container.current, { center: { lat: 52.1, lng: 5.3 }, zoom: 7, mapId, mapTypeControl: false, streetViewControl: false, gestureHandling: 'cooperative', fullscreenControl: true });
      setReady(true);
    }).catch(() => { if (active) setError('De kaart kon niet worden geladen. Controleer je verbinding of gebruik de lijst.'); });
    return () => { active = false; if (window.gm_authFailure === authenticationFailed) delete window.gm_authFailure; map.current = null; };
  }, [allowed, key, mapId]);

  useEffect(() => {
    if (!ready || !map.current) return;
    const bounds = new google.maps.LatLngBounds();
    const markers = locations.map((location) => {
      const position = { lat: location.latitude, lng: location.longitude };
      bounds.extend(position);
      const marker = new google.maps.marker.AdvancedMarkerElement({ map: map.current, position, title: `${location.title}, ${location.addressLine}, ${location.city}` });
      marker.addListener('click', () => select.current(location.id));
      return marker;
    });
    if (locations.length === 1) { map.current.setCenter(bounds.getCenter()); map.current.setZoom(16); }
    else if (locations.length > 1) map.current.fitBounds(bounds, 48);
    return () => { markers.forEach((marker) => { google.maps.event.clearInstanceListeners(marker); marker.map = null; }); };
  }, [locations, ready]);

  return <div className="wk-map-shell">
    {!allowed || !configured ? <div className="wk-map-notice"><span className="wk-round-icon"><MapPin /></span><h3>Jouw buurt op de kaart</h3>
      {configured ? <><p>De kaart wordt geleverd door Google Maps. Pas als je de kaart opent, maakt je browser verbinding met Google.</p><button className="wk-button" type="button" onClick={() => setAllowed(true)}>Google Maps openen</button><a className="wk-text-button" href="https://policies.google.com/privacy" target="_blank" rel="noreferrer"><ShieldCheck size={16} />Privacy bij Google</a></>
        : <><p>Google Maps is voor deze website nog niet geactiveerd. Je vindt de adressen in de lijst en kunt van daaruit direct een route openen.</p><span className="wk-quiet">De beheerder moet de Google Maps-koppeling instellen.</span></>}
    </div> : <><div className="wk-google-map" ref={container} aria-label="Google Maps met weggeefkastjes" />{!ready && !error && <p className="wk-map-status" role="status">Google Maps laden…</p>}{error && <p className="wk-map-status wk-error" role="alert">{error}</p>}</>}
  </div>;
}
