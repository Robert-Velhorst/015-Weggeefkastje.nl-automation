import { type FormEvent, useEffect, useState } from 'react';
import { CheckCircle2, HeartHandshake, ShieldCheck } from 'lucide-react';
import { api } from './api';
import { PRODUCT_CATEGORIES } from '../../src/categories';
import './resident.css';

interface CaretakerLocation {
  id: string; title: string; addressLine: string; postalCode: string; city: string;
  status: 'active' | 'inactive'; categories: string[]; lastVerifiedAt: string;
}
function caretakerToken(): string {
  try { return decodeURIComponent(window.location.pathname.split('/').filter(Boolean).at(-1) ?? ''); }
  catch { return ''; }
}

export function CaretakerApp() {
  const token = caretakerToken();
  const [location, setLocation] = useState<CaretakerLocation>();
  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [categories, setCategories] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    api.request<CaretakerLocation>(`/api/public/caretaker/${encodeURIComponent(token)}`, { signal: controller.signal })
      .then((value) => { if (!controller.signal.aborted) { setLocation(value); setTitle(value.title); setAddress(value.addressLine); setPostalCode(value.postalCode); setCity(value.city); setStatus(value.status); setCategories(value.categories); } })
      .catch(() => { if (!controller.signal.aborted) setError('Deze beheerlink is niet beschikbaar.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving) return;
    setError(''); setSaved(false); setSaving(true);
    try {
      const updated = await api.request<CaretakerLocation>(`/api/public/caretaker/${encodeURIComponent(token)}`, { method: 'POST', body: JSON.stringify({ title, address, postalCode, city, status, categories }) });
      setLocation(updated); setAddress(updated.addressLine); setPostalCode(updated.postalCode); setCity(updated.city); setCategories(updated.categories); setSaved(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'De wijziging kon niet worden opgeslagen.'); }
    finally { setSaving(false); }
  }
  return <div className="neighborhood-site"><header className="wk-header wk-container"><a className="wk-brand" href="/"><HeartHandshake /><span>Weggeefkastje.nl</span></a></header>
    <main className="wk-owner-editor">{loading ? <p role="status">Beheerlink controleren…</p> : !location ? <><h1>Deze beheerlink is niet beschikbaar</h1><p>De link is mogelijk verlopen of ingetrokken. Controleer ook je internetverbinding.</p><a className="wk-button" href="/">Naar de bewonersvinder</a></> : <>
      <p className="wk-eyebrow">JOUW KASTJE BIJWERKEN</p><h1>Houd je kastje actueel.</h1><p>Alleen een volledig, gecontroleerd adres kan zichtbaar zijn voor buurtbewoners.</p>
      <form onSubmit={submit}><label>Naam van het kastje<input value={title} onChange={(event) => setTitle(event.target.value)} minLength={3} maxLength={160} required /></label>
        <label>Straat en huisnummer<input value={address} onChange={(event) => setAddress(event.target.value)} minLength={5} maxLength={240} required /></label>
        <div className="wk-owner-address"><label>Postcode<input value={postalCode} onChange={(event) => setPostalCode(event.target.value)} required /></label><label>Plaats<input value={city} onChange={(event) => setCity(event.target.value)} required /></label></div>
        <fieldset><legend>Wat is er doorgaans te vinden?</legend><p>Dit is geen voorraadlijst. Kies alle soorten die passen bij jouw kastje.</p><div className="wk-owner-categories">{[...new Set([...PRODUCT_CATEGORIES, ...location.categories, ...categories])].map((category) => <label key={category}><input type="checkbox" value={category} checked={categories.includes(category)} onChange={(event) => setCategories(event.target.checked ? [...categories, category] : categories.filter((value) => value !== category))} />{category}</label>)}</div></fieldset>
        <label>Staat het kastje er nu?<select value={status} onChange={(event) => setStatus(event.target.value as 'active' | 'inactive')}><option value="active">Ja, zichtbaar voor buurtbewoners</option><option value="inactive">Nee, tijdelijk niet zichtbaar</option></select></label>
        {error && <p className="wk-error" role="alert">{error}</p>}{saved && <p className="wk-success" role="status"><CheckCircle2 size={17} aria-hidden="true" /> Je wijziging is opgeslagen.</p>}
        <button className="wk-button" type="submit" disabled={saving}>{saving ? 'Opslaan…' : 'Gegevens opslaan'}</button>
      </form><p className="wk-owner-note"><ShieldCheck size={17} aria-hidden="true" />Deze persoonlijke link geldt alleen voor dit kastje. Deel hem niet openbaar.</p>
    </>}</main></div>;
}
