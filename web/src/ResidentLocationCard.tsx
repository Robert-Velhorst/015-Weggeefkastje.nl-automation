import { useState, type FormEvent } from 'react';
import { ArrowUpRight, Check, MapPin } from 'lucide-react';
import { api, type PublicLocation } from './api';

export function ResidentLocationCard({ location }: { location: PublicLocation }) {
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      await api.request(`/api/public/locations/${encodeURIComponent(location.id)}/reports`, { method: 'POST', body: JSON.stringify({ reason }) });
      setSent(true); setReporting(false); setReason('');
    } catch { setError('De melding is niet verstuurd. Probeer het nog een keer.'); }
    finally { setBusy(false); }
  }
  const date = new Date(location.lastVerifiedAt);
  return <article className="wk-location">
    <span className="wk-location-symbol"><MapPin aria-hidden="true" /></span>
    <div className="wk-location-info"><h3>{location.title}</h3><address>{location.addressLine}<br />{location.postalCode} {location.city}</address>
      <ul className="wk-tags" aria-label="Gebruikelijk aanbod">{(location.categories.length ? location.categories : ['Aanbod niet bekend']).map((category) => <li key={category}>{category}</li>)}</ul>
      <p className="wk-verified"><Check size={14} aria-hidden="true" />Adres gecontroleerd{Number.isNaN(date.getTime()) ? '' : ` op ${new Intl.DateTimeFormat('nl-NL', { dateStyle: 'long' }).format(date)}`}</p>
    </div>
    <div className="wk-location-actions"><a className="wk-button" href={location.directionsUrl} target="_blank" rel="noreferrer">Route in Google Maps <ArrowUpRight size={17} aria-hidden="true" /></a>
      {!sent && <button className="wk-text-button" type="button" aria-expanded={reporting} onClick={() => setReporting(!reporting)}>Kloppen de gegevens niet?</button>}
    </div>
    {sent && <p className="wk-success" role="status">Bedankt! We controleren je melding voordat er iets verandert.</p>}
    {reporting && <form className="wk-report" onSubmit={submit}>
      <label htmlFor={`report-${location.id}`}>Wat klopt er niet?</label><textarea id={`report-${location.id}`} value={reason} onChange={(event) => setReason(event.target.value)} minLength={3} maxLength={800} required placeholder="Bijvoorbeeld: het kastje staat er niet meer." />
      <p>Laat geen namen, telefoonnummers of andere persoonsgegevens achter.</p>
      {error && <p className="wk-error" role="alert">{error}</p>}
      <div className="wk-inline"><button className="wk-button" disabled={busy} type="submit">{busy ? 'Versturen…' : 'Melding versturen'}</button><button className="wk-text-button" disabled={busy} type="button" onClick={() => setReporting(false)}>Annuleren</button></div>
    </form>}
  </article>;
}
