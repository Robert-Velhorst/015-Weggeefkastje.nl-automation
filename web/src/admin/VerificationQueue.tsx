import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import type { LocationUpdateRequest } from '../../../src/domain/residentLocation';
import type { VerificationNote, VerificationNoteInput } from '../../../src/domain/verificationNote';
import './verification.css';

const outcomes: Record<VerificationNoteInput['outcome'], string> = {
  screened: 'Alleen eerste screening', needs_evidence: 'Aanvullend bewijs nodig', conflicting_evidence: 'Tegenstrijdige informatie',
  corroborated: 'Aanvullende bron gevonden', address_corrected: 'Adrescorrectie gecontroleerd',
};
const reasons: Record<string, string> = { exact_address_required: 'Exact adres ontbreekt', address_not_verified: 'Adres niet bevestigd in BAG', address_enrichment_not_unique: 'Meerdere mogelijke adressen', source_not_authorized: 'Brontoestemming ontbreekt', source_review_required: 'Bron vereist beoordeling' };
const date = (value: string) => new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
function SourceLink({ url }: { url: string }) {
  try { const parsed = new URL(url); if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) return null; }
  catch { return null; }
  return <a href={url} target="_blank" rel="noreferrer">{new URL(url).hostname} — bron openen</a>;
}
function Note({ note }: { note: VerificationNote }) {
  return <div className="verification-note"><span className="status status-rules_review">{outcomes[note.outcome]}</span>
    <p><strong>Bevindingen</strong><br />{note.findings}</p><p><strong>Nog controleren</strong><br />{note.remainingChecks}</p>
    {note.searchArea && <p className="muted">Zoekgebied: {note.searchArea} (geen bevestigd kastadres)</p>}
    <ul>{note.sourceUrls.map(url => <li key={url}><SourceLink url={url} /></li>)}</ul><small>Onderzocht: {date(note.checkedAt)} · vastgelegd: {date(note.createdAt)}</small>
  </div>;
}
function NoteForm({ id, saved }: { id: string; saved: () => void }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); setBusy(true); setError('');
    try {
      await api.request(`/api/location-update-requests/${id}/verification-notes`, { method: 'POST', body: JSON.stringify({
        outcome: data.get('outcome'), findings: data.get('findings'), remainingChecks: data.get('remainingChecks'), searchArea: data.get('searchArea'),
        sourceUrls: String(data.get('sourceUrls')).split('\n').map(s => s.trim()).filter(Boolean), checkedAt: new Date().toISOString(),
      }) }); saved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Opslaan mislukt.'); }
    finally { setBusy(false); }
  }
  return <details className="verification-edit"><summary>Onderzoeksnotitie toevoegen</summary><form onSubmit={submit}>
    <label>Uitkomst<select name="outcome">{Object.entries(outcomes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    <label>Bevindingen<textarea name="findings" required minLength={3} maxLength={2000} /></label>
    <label>Nog controleren<textarea name="remainingChecks" required minLength={3} maxLength={1500} /></label>
    <label>Zoekgebied (optioneel)<input name="searchArea" maxLength={160} /></label>
    <label>Bronlinks (één per regel, maximaal 10)<textarea name="sourceUrls" /></label>
    <p className="muted">Bewaar alleen noodzakelijke locatiegegevens. Opslaan publiceert niets en sluit de melding niet af. Brontoestemming en fysieke aanwezigheid worden hiermee niet automatisch bevestigd.</p>
    {error && <p role="alert" className="form-error">{error}</p>}<button className="secondary" disabled={busy}>{busy ? 'Opslaan…' : 'Notitie opslaan'}</button>
  </form></details>;
}

export function VerificationQueue({ canWrite = false }: { canWrite?: boolean }) {
  const [page, setPage] = useState(1); const [query, setQuery] = useState(''); const [draftQuery, setDraftQuery] = useState('');
  const [status, setStatus] = useState('pending'); const [researched, setResearched] = useState('all'); const [revision, setRevision] = useState(0);
  const [data, setData] = useState<{ items: LocationUpdateRequest[]; total: number }>({ items: [], total: 0 });
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [busy, setBusy] = useState(''); const [message, setMessage] = useState('');
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    const params = new URLSearchParams({ status, query, researched, page: String(page), limit: '25' });
    api.request<typeof data>(`/api/location-update-requests?${params}`, { signal: controller.signal }).then(value => { if (!controller.signal.aborted) setData(value); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Onderzoek laden mislukt.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, query, status, researched, revision]);
  async function resolve(id: string, resolution: string) {
    setBusy(id); setError('');
    try { await api.request(`/api/location-update-requests/${id}/resolve`, { method: 'POST', body: JSON.stringify({ status: resolution }) }); setMessage('Melding afgehandeld. Er is geen locatie gepubliceerd.'); setRevision(r => r + 1); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Afhandelen mislukt.'); } finally { setBusy(''); }
  }
  const pages = Math.max(1, Math.ceil(data.total / 25));
  return <section className="verification-queue" aria-labelledby="verification-title">
    <div className="section-heading"><div><p className="eyebrow">BRONNEN EN BETROUWBAARHEID</p><h3 id="verification-title">Vondsten verifiëren</h3></div><button className="text-button" onClick={() => setRevision(r => r + 1)} disabled={loading}>Onderzoek vernieuwen</button></div>
    <p>Een geldig adres is nog geen bewijs dat een kastje daar bestaat of toegankelijk is. Houd bevindingen, ontbrekend bewijs en toestemming apart.</p>
    <form className="verification-filters" onSubmit={event => { event.preventDefault(); setQuery(draftQuery.trim()); setPage(1); }}>
      <label>Zoek in vondsten en onderzoek<input value={draftQuery} onChange={event => setDraftQuery(event.target.value)} maxLength={160} placeholder="Bijvoorbeeld Gouda, straat of bronnummer" /></label><button className="secondary">Zoeken</button>
      <label>Meldingsstatus<select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="pending">Openstaand</option><option value="resolved">Afgehandeld</option><option value="dismissed">Niet overgenomen</option></select></label>
      <label>Onderzoeksnotities<select value={researched} onChange={event => { setResearched(event.target.value); setPage(1); }}><option value="all">Alle vondsten</option><option value="yes">Met notities (ook screening)</option><option value="no">Zonder notities</option></select></label>
    </form>
    {message && <p role="status">{message}</p>}{error && <p role="alert" className="form-error">{error}</p>}
    {loading ? <p role="status">Vondsten laden…</p> : !error && <>
      <p className="verification-count">{data.total} resultaten · pagina {page} van {pages}</p>
      {data.items.length === 0 && <p>Geen vondsten voor deze selectie.</p>}
      <div className="verification-results">{data.items.map(item => <article key={item.id} className="verification-card">
        <header><h4>{item.candidate?.title || (item.requestType === 'public_report' ? 'Melding van een bezoeker' : 'Locatie ter beoordeling')}</h4><span className="status status-rules_review">{reasons[item.reason] || item.reason}</span></header>
        <p>{item.candidate?.address ? `Bronadres (niet automatisch bevestigd): ${[item.candidate.address, item.candidate.postalCode, item.candidate.city].filter(Boolean).join(', ')}` : 'Geen volledig bronadres beschikbaar.'}</p>
        <small>{item.candidate?.sourceRecordId} · ontvangen {date(item.createdAt)}</small>
        <details><summary>Oorspronkelijk bronbewijs</summary><p>{item.candidate?.evidenceSummary || item.reason}</p>{item.candidate?.sourceLink && <SourceLink url={item.candidate.sourceLink} />}</details>
        {item.verificationNotes?.length ? <><Note note={item.verificationNotes[0]} />{item.verificationNotes.length > 1 && <details><summary>Eerdere onderzoeksnotities ({item.verificationNotes.length - 1})</summary>{item.verificationNotes.slice(1).map(note => <Note key={note.id} note={note} />)}</details>}</> : <p>Nog geen onderzoeksnotities. Dit is geen bevestigde locatie.</p>}
        {canWrite && <NoteForm id={item.id} saved={() => { setMessage('Onderzoeksnotitie opgeslagen; publicatiestatus ongewijzigd.'); setRevision(r => r + 1); }} />}
        {canWrite && item.status === 'pending' && <details><summary>Melding afsluiten (publiceert niets)</summary><p>Sluit alleen af als de benodigde opvolging is uitgevoerd. Onderzoek en oorspronkelijke melding blijven bewaard.</p><button className="secondary" disabled={!!busy} onClick={() => void resolve(item.id, 'resolved')}>Afgehandeld</button><button className="text-button" disabled={!!busy} onClick={() => void resolve(item.id, 'dismissed')}>Niet overnemen</button></details>}
      </article>)}</div>
      <nav className="verification-pagination" aria-label="Pagina’s met vondsten"><button className="secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Vorige</button><span>{page} / {pages}</span><button className="secondary" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Volgende</button></nav>
    </>}
  </section>;
}
