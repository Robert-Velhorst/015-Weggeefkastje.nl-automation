import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, CircleHelp, Download, Heart, HeartHandshake, Leaf, List, Map, MapPin, Package, Search, Shirt, SlidersHorizontal, Smartphone, Snowflake, Sparkles, Sprout, ToyBrick, X } from 'lucide-react';
import { api, type PublicAttribution, type PublicLocationList } from './api';
import { GoogleMap } from './GoogleMap';
import { InstallApp } from './InstallApp';
import { ResidentLocationCard } from './ResidentLocationCard';
import { PRODUCT_CATEGORIES, PROVINCES, readSearchState, searchParams, type SearchState } from './residentSearch';
import './resident.css';

const icons = [BookOpen, Package, Shirt, Snowflake, Sparkles, ToyBrick, Heart, Sprout];
const categoryOptions = [...PRODUCT_CATEGORIES.map((value, index) => ({ value, label: value, Icon: icons[index] })), { value: 'unknown', label: 'Aanbod niet bekend', Icon: CircleHelp }];
interface Results extends PublicLocationList { truncated?: boolean }
const EMPTY_LOCATIONS: PublicLocationList['items'] = [];

export function ResidentApp() {
  const [state, setState] = useState(readSearchState);
  const [query, setQuery] = useState(state.query);
  const [result, setResult] = useState<Results>();
  const [attributions, setAttributions] = useState<PublicAttribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const details = useRef<HTMLDivElement>(null);
  const params = searchParams(state, state.view === 'list').toString();

  function update(patch: Partial<SearchState>) {
    const next = { ...state, page: 1, ...patch };
    const url = searchParams(next);
    if (next.page > 1) url.set('page', String(next.page));
    if (next.view === 'map') url.set('view', 'map');
    window.history.pushState({}, '', `${window.location.pathname}${url.size ? `?${url}` : ''}${window.location.hash}`);
    setState(next);
  }
  useEffect(() => {
    const restore = () => { const next = readSearchState(); setState(next); setQuery(next.query); };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setSelected(''); setDownloadError('');
    Promise.all([
      api.request<Results>(`/api/public/${state.view === 'map' ? 'map' : 'locations'}?${params}`, { signal: controller.signal }),
      api.request<PublicAttribution[]>('/api/public/attributions', { signal: controller.signal }),
    ]).then(([response, sources]) => {
      if (!controller.signal.aborted) { setResult(response); setAttributions(sources); }
    }).catch(() => {
      if (!controller.signal.aborted) { setError('We kunnen de kastjes even niet ophalen. Controleer je verbinding en probeer het opnieuw.'); setResult(undefined); }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [params, state.view, retry]);
  function search(event: FormEvent) { event.preventDefault(); update({ query: query.trim() }); document.getElementById('kastjes')?.scrollIntoView?.({ behavior: 'instant', block: 'start' }); }
  function reset() { setQuery(''); update({ query: '', category: [], province: '', sort: 'address' }); }
  const filtered = Boolean(state.query || state.category.length || state.province);
  const visibleLocations = result?.items ?? [];
  const selectedLocation = visibleLocations.find((location) => location.id === selected);
  const pages = Math.max(1, Math.ceil((result?.total ?? 0) / 12));
  const exportUrl = `/api/public/locations.kml?${searchParams(state)}`;
  async function download(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault(); if (downloading) return;
    setDownloading(true); setDownloadError('');
    try {
      const response = await fetch(exportUrl, { credentials: 'same-origin' });
      if (!response.ok) { const body = await response.json(); throw new Error(body.error?.message ?? 'De export is niet beschikbaar.'); }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = url; link.download = 'weggeefkastjes.kml'; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) { setDownloadError(cause instanceof Error ? cause.message : 'Download mislukt. Probeer het opnieuw.'); }
    finally { setDownloading(false); }
  }

  return <div className="neighborhood-site">
    <a className="wk-skip" href="#kastjes">Direct naar de kastjes</a>
    <header className="wk-header wk-container"><a className="wk-brand" href="/" aria-label="Weggeefkastje.nl, naar de startpagina"><HeartHandshake aria-hidden="true" /><span>Weggeefkastje<span className="wk-brand-nl">.nl</span></span></a>
      <nav aria-label="Hoofdnavigatie"><a href="#kastjes">Vind een kastje</a><a href="#hoe-werkt-het">Hoe werkt het?</a><a href="#eigenaren">Voor eigenaren</a></nav><a className="wk-app-link" href="#app"><Smartphone size={18} aria-hidden="true" /><span>De app</span></a>
    </header>
    <main>
      <section className="wk-hero"><div className="wk-hero-inner wk-container"><div className="wk-hero-copy"><p className="wk-eyebrow"><span />KLEIN KASTJE, GROOT VERSCHIL</p><h1>Een klein kastje.<br />Een groot gebaar.</h1><p className="wk-intro">Vind een weggeefkastje in jouw buurt.<br className="wk-desktop-break" /> Neem mee wat je kunt gebruiken,<br className="wk-desktop-break" /> geef door wat je kunt missen.</p>
        <form className="wk-search" onSubmit={search} aria-label="Zoek een weggeefkastje"><label htmlFor="wk-query">Waar wil je een kastje vinden?</label><div><Search size={22} aria-hidden="true" /><input id="wk-query" type="search" enterKeyHint="search" maxLength={240} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Plaats, postcode of straat" /><button className="wk-button" type="submit">Zoek een kastje <ArrowRight size={17} aria-hidden="true" /></button></div></form>
        <p className="wk-reassurance"><Heart size={16} aria-hidden="true" />Gratis voor iedereen. Zonder account.</p>
      </div><div className="wk-hero-art"><img src="/images/buurtkastje.webp" alt="Illustratie van een blauw buurtkastje met boeken, potjes en planten in een Nederlandse straat" width="1536" height="1024" fetchPriority="high" /><span className="wk-art-caption"><Heart size={15} fill="currentColor" aria-hidden="true" />Van de buurt. Voor de buurt.</span></div></div></section>

      <section className="wk-finder wk-container" id="kastjes" aria-labelledby="finder-title"><div className="wk-section-heading"><div><p className="wk-eyebrow">ER IS ALTIJD IETS OM TE DELEN</p><h2 id="finder-title">Ontdek kastjes in de buurt</h2></div><div className="wk-view-toggle" aria-label="Weergave"><button type="button" aria-pressed={state.view === 'list'} onClick={() => update({ view: 'list' })}><List size={18} aria-hidden="true" />Lijst</button><button type="button" aria-pressed={state.view === 'map'} onClick={() => update({ view: 'map' })}><Map size={18} aria-hidden="true" />Kaart</button></div></div>
        <div className="wk-filters"><div className="wk-filter-caption"><span>Wat zoek je?</span><span>Je kunt meerdere soorten kiezen.</span></div><div className="wk-category-buttons" aria-label="Filter op gebruikelijk aanbod">{categoryOptions.map(({ value, label, Icon }) => <button type="button" key={value} aria-pressed={state.category.includes(value)} onClick={() => update({ category: state.category.includes(value) ? state.category.filter((category) => category !== value) : [...state.category, value] })}><Icon size={17} aria-hidden="true" />{label}{state.category.includes(value) && <Check size={14} aria-hidden="true" />}</button>)}</div>
          <div className="wk-filter-bottom"><p>Het aanbod wisselt. De categorieën zijn geen actuele voorraad.</p><details className="wk-more-filters"><summary><SlidersHorizontal size={16} aria-hidden="true" />Meer filters</summary><div><label>Provincie<select value={state.province} onChange={(event) => update({ province: event.target.value })}><option value="">Heel Nederland</option>{PROVINCES.map((province) => <option key={province}>{province}</option>)}</select></label><label>Volgorde<select value={state.sort} onChange={(event) => update({ sort: event.target.value as SearchState['sort'] })}><option value="address">Plaats en adres</option><option value="recent">Recent gecontroleerd</option></select></label></div></details></div>
        </div>
        {filtered && <div className="wk-active-filters"><span>{[state.query && `Zoeken: ${state.query}`, state.province, state.category.length && `${state.category.length} soort(en) aanbod`].filter(Boolean).join(' · ')}</span><button className="wk-text-button" type="button" onClick={reset}><X size={16} aria-hidden="true" />Wis filters</button></div>}
        <div className="wk-results-status" role="status">{loading ? 'Even zoeken…' : error ? '' : `${result?.total ?? 0} ${(result?.total ?? 0) === 1 ? 'kastje' : 'kastjes'} gevonden`}</div>
        {attributions.some(source => source.name.startsWith('OpenStreetMap')) && <p aria-label="Licentie locatiegegevens">Locatiegegevens: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a> · <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">ODbL 1.0</a>. Adressen gecontroleerd via Kadaster/BAG (PDOK). Geen garantie op aanwezigheid, openingstijden of voorraad.</p>}
        {state.view === 'map' && <GoogleMap locations={loading || error ? EMPTY_LOCATIONS : visibleLocations} onSelect={(id) => { setSelected(id); requestAnimationFrame(() => { details.current?.focus({ preventScroll: true }); details.current?.scrollIntoView({ block: 'nearest' }); }); }} />}
        {error && <div className="wk-empty wk-error" role="alert"><CircleHelp /><h3>Even geen verbinding</h3><p>{error}</p><button className="wk-button" type="button" onClick={() => setRetry((value) => value + 1)}>Opnieuw proberen</button></div>}
        {loading && state.view === 'list' && <div className="wk-loading" aria-hidden="true"><span /><span /><span /></div>}
        {!loading && !error && <>
          {state.view === 'map' && <>
            {result?.truncated && <p className="wk-warning" role="status">De kaart toont de eerste 2.000 van {result.total} kastjes. Kies een plaats of provincie om alle kastjes in dat gebied te zien.</p>}
            <div className="wk-map-selection" ref={details} tabIndex={-1}>{selectedLocation ? <><ResidentLocationCard key={selectedLocation.id} location={selectedLocation} /><button className="wk-text-button" type="button" onClick={() => setSelected('')}>Sluit details</button></> : visibleLocations.length > 0 && <p>Tik op een speld voor het adres en aanbod. Liever geen kaart? Alle kastjes staan ook in de lijst.</p>}</div></>}
          {visibleLocations.length === 0 && <div className="wk-empty"><span className="wk-round-icon"><MapPin size={32} aria-hidden="true" /></span><h3>{result?.total ? 'Deze resultaatpagina is leeg' : filtered ? 'Hier hebben we nog geen kastje gevonden' : 'De eerste kastjes komen eraan'}</h3><p>{result?.total ? 'Er zijn wel kastjes gevonden. Ga terug naar de eerste pagina.' : filtered ? 'Probeer een andere plaats of kies minder filters. Niet ieder kastje is al bij ons bekend.' : 'Zodra er locaties met een gecontroleerd adres beschikbaar zijn, vind je ze hier. Zo helpen we je op weg naar de juiste plek.'}</p>{Boolean(result?.total) && <button className="wk-text-button" type="button" onClick={() => update({ page: 1 })}>Naar de eerste pagina <ArrowRight size={16} /></button>}{filtered && <button className="wk-text-button" type="button" onClick={reset}>Bekijk alle kastjes <ArrowRight size={16} /></button>}</div>}
          {state.view === 'list' && visibleLocations.length > 0 && <><div className="wk-locations">{visibleLocations.map((location) => <ResidentLocationCard key={location.id} location={location} />)}</div>{pages > 1 && <nav className="wk-pagination" aria-label="Resultaatpagina’s"><button className="wk-button wk-button-light" type="button" disabled={state.page <= 1} onClick={() => update({ page: state.page - 1 })}><ArrowLeft size={16} />Vorige</button><span>Pagina {state.page} van {pages}</span><button className="wk-button wk-button-light" type="button" disabled={state.page >= pages} onClick={() => update({ page: state.page + 1 })}>Volgende<ArrowRight size={16} /></button></nav>}</>}
        </>}
        <details className="wk-export"><summary>Deze kastjes bekijken in Google My Maps</summary><p>Download je selectie en importeer het bestand op een computer in <a href="https://mymaps.google.com/" target="_blank" rel="noreferrer">Google My Maps</a>. Het is een momentopname; wijzigingen worden niet automatisch overgenomen. Maximaal 2.000 kastjes per export.</p><a className="wk-text-button" href={exportUrl} download="weggeefkastjes.kml" onClick={(event) => void download(event)} aria-disabled={downloading}><Download size={16} />{downloading ? 'Download voorbereiden…' : 'Download deze selectie (.kml)'}</a>{downloadError && <p className="wk-error" role="alert">{downloadError}</p>}</details>
      </section>

      <section className="wk-how" id="hoe-werkt-het"><div className="wk-container"><p className="wk-eyebrow">SAMEN MAKEN WE HET VERSCHIL</p><h2>Kleine moeite. Fijn voor de buurt.</h2><div className="wk-steps"><div><Search aria-hidden="true" /><h3>Vind een kastje</h3><p>Zoek in jouw buurt en bekijk het adres en het gebruikelijke aanbod.</p></div><div><HeartHandshake aria-hidden="true" /><h3>Neem of geef iets</h3><p>Neem wat je kunt gebruiken. Iets over? Geef het door als het in het kastje past.</p></div><div><Leaf aria-hidden="true" /><h3>Houd het fijn</h3><p>Laat het netjes achter en volg de aanwijzingen bij het kastje.</p></div></div></div></section>
      <InstallApp />
      <section className="wk-owner" id="eigenaren"><div className="wk-container"><div><p className="wk-eyebrow">VOOR DE MENS ACHTER HET KASTJE</p><h2>Jij deelt. Wij helpen je vinden.</h2><p>Als eigenaar houd je via een persoonlijke beheerlink het adres, het aanbod en de zichtbaarheid van je kastje actueel.</p></div><details><summary>Hoe werk ik mijn kastje bij?</summary><p>Gebruik de persoonlijke beheerlink die je van het project hebt ontvangen. Die link geeft alleen toegang tot jouw kastje. Deel hem niet openbaar.</p><p>Heb je geen link? Vraag de projectbeheerder om toegang. Nieuwe locaties komen via onze gecontroleerde bronnen binnen.</p></details></div></section>
    </main>
    <footer className="wk-footer"><div className="wk-container"><div className="wk-footer-top"><a className="wk-brand" href="/"><HeartHandshake aria-hidden="true" /><span>Weggeefkastje.nl</span></a><span>Een beetje delen brengt ons dichterbij.</span><a href="/beheer">Projectbeheer <ArrowRight size={14} /></a></div><div className="wk-footer-bottom"><p>Zoeken kan zonder account of toegang tot je apparaatlocatie. Google wordt pas geladen als je zelf de kaart of een route opent.</p><details><summary>Bronnen & privacy</summary><p>De illustratie is geen foto van een echte locatie. Adressen komen uit de catalogus; een adrescontrole garandeert geen voorraad of openingstijd.</p><p>We bewaren geen zoekprofiel. Meldingen worden bewaard voor controle: vul geen persoonsgegevens in. De server verwerkt technische verzoekgegevens voor werking en beveiliging.</p>{attributions.length > 0 ? <ul>{attributions.map((source) => <li key={`${source.name}-${source.attribution}`}>{source.name} — {source.attribution}</li>)}</ul> : <p>Bronvermeldingen verschijnen zodra er openbare locaties beschikbaar zijn.</p>}<p><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap-licentie</a> · <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Privacy bij Google</a></p></details></div></div></footer>
  </div>;
}
