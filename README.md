# Weggeefkastje.nl Automation

Een lokale, privacybewuste toepassing voor mensen die een **weggeefkastje** of buurtkastje zoeken, en voor de kleine beheerorganisatie die die locaties zorgvuldig actueel houdt.

De bewonersvinder staat centraal: een buurtbewoner kan zonder account op een exact, gecontroleerd adres zoeken en zelf een route openen. De beheeromgeving en worker verzamelen alleen toegestane broninformatie, vergelijken die met de catalogus en verwerken wijzigingen met een controleerbare geschiedenis.

De bewonerswebsite is ook een **installeerbare webapp (PWA)** voor telefoon en computer. Dezelfde catalogus is als lijst en als Google Maps-kaart beschikbaar, met filters voor het gebruikelijke aanbod. De Google-kaart vereist eigen configuratie; de lijst en rechtstreekse navigatielinks werken zonder Google API-sleutel.

> **Belangrijke grens:** dit project bouwt geen algemene social-media-scraper. Het omzeilt geen inlog, captcha of platformbeperking, leest geen privéberichten en plaatst niets op Facebook of Nextdoor. Facebook kan uitsluitend via een expliciete Page-allowlist en de officiële Graph API worden gelezen. Nextdoor vereist een formeel toegestane export of later een geautoriseerde partnerkoppeling. Een ingelogde browser is nooit toestemming om gegevens te oogsten.

## In één oogopslag

| Onderdeel | Wat het doet | Wat het bewust niet doet |
| --- | --- | --- |
| **/** | Mobiele website en installeerbare webapp met zoeken, aanbodfilters, lijst, optionele Google-kaart en routes | Vraagt geen account of browserlocatie; toont geen intern bronbewijs en belooft geen actuele voorraad |
| **/kastje-bijwerken/:token** | Persoonlijke, tijdgebonden link waarmee de beheerder van één kastje gegevens kan bijwerken | Geeft geen toegang tot andere kastjes, bronnen of de beheeromgeving |
| **/beheer** | Ingelogde beheeromgeving voor bronbeleid, catalogusreview, meldingen en beheerlinks | Is niet de openbare bewonerservaring |
| **Worker** | Leest alleen geconfigureerde, toegestane bronnen en verwerkt die duurzaam | Geen browser-scraping, geen berichten plaatsen, geen automatische verwijdering op basis van één melding |
| **SQLite** | Bewaart catalogus, bronregister, audittrail en bestaande handmatige workflow lokaal | Geen SaaS-account of externe databank nodig |

De interface is Nederlands. Deze README is ook Nederlands, zodat bewonersgerichte beheerders en softwareontwikkelaars dezelfde bron van waarheid hebben.

## Productie installeren

De openbare HTTPS-installatie staat in **[docs/PRODUCTION.md](docs/PRODUCTION.md)**: releasecontrole, bestaande catalogus behouden, veilige initialisatie, Caddy/HTTPS, app/worker, automatische gecontroleerde back-ups, monitoring en rollback. Gebruik daarvoor `compose.production.yml` met `.env.production`; `docker-compose.yml` is de lokale ontwikkelvariant. Een lokale build/test is geen bewijs van een werkende live deployment of geautoriseerde providerkoppeling.

## Voor wie is dit?

### Buurtbewoners

De primaire gebruiker. Iemand zoekt een kastje in de buurt, ziet alleen een volledig bevestigd adres en opent desgewenst zelf een route. Er is geen account, geen locatie-tracking en geen formulier om nieuwe locaties openbaar te maken.

### Eigenaren of verzorgers van een kastje

Elke vermelding kan een persoonlijke beheerlink krijgen. Daarmee kan de eigenaar alleen het eigen kastje actueel houden of tijdelijk onzichtbaar maken. Een adreswijziging wordt opnieuw exact gecontroleerd voordat deze zichtbaar kan worden.

### Beheerder van de catalogus

Een kleine beheerorganisatie registreert bronnen, bewaakt toestemming/licentie, kiest per bron tussen automatisch verwerken of eerst beoordelen, lost meldingen op en maakt beheerlinks. Gemeenten, donateurs en sociale-media-platforms zijn geen primaire gebruikers van dit product.

### Ontwikkelaars en operators

Zij installeren de Node/SQLite-toepassing, draaien de webserver en worker, beheren omgevingsvariabelen, maken back-ups en voeren de test- en releasecontroles uit.

## Productregels die de code afdwingt

1. **Exact adres is verplicht voor een openbare vermelding.** Straat, huisnummer, postcode en plaats moeten samen door de officiële PDOK Locatieserver worden bevestigd. Een vaag adres, alleen coördinaten of een onzekere social-post verschijnt nooit publiek.
2. **Bewoners zien alleen actieve, gepubliceerde locaties.** Interne bronlinks, volledige berichten, toestemmingreferenties en auditdetails blijven server-side.
3. **Automatisering is per bron instelbaar.** Alleen een ingeschakelde bron met expliciete toestemming voor exacte adressen mag in **automatic**-modus een actieve, PDOK-bevestigde locatie publiceren. De standaard is **review**.
4. **Een melding verwijdert niets automatisch.** Een publiek rapport, een onzeker signaal of een bron die verdwijnt maakt hoogstens een open wijzigingsverzoek. Een beheerder of de eigen beheerder neemt een zichtbare wijziging.
5. **Alle relevante mutaties zijn traceerbaar.** Nieuwe bronregels, bewijs, automatische publicatie, reviewbeslissingen, beheerlinks en eigenaarwijzigingen worden gelogd.
6. **Dataminimalisatie gaat voor dekking.** Persoonsgegevens, profielen, privégesprekken en volledige bronposts horen niet in openbare resultaten en worden niet als productvereiste verzameld.

## Hoe een locatie van bron naar bewoner gaat

    Toegestane bron of export
              |
              v
    Bronadapter + term-/privacyfilter
              |
              +-- geen exact volledig adres --> intern wijzigingsverzoek
              |
              v
    PDOK bevestigt straat + huisnummer + postcode + plaats
              |
              +-- geen exacte match --> intern wijzigingsverzoek
              |
              v
    Bronbeleid
       | automatic + actief + adresrecht       | review / onzeker / verwijderd
       v                                      v
    Publieke catalogus                    Reviewwachtrij
       |                                      |
       v                                      v
    Bewonersvinder                    Beheerder beslist

Een eigenaarwijziging loopt opnieuw door de PDOK-adrescontrole. De eigenaar kan een kastje tijdelijk **inactive** maken; dat haalt het uit de openbare lijst zonder de historische gegevens te verwijderen.

## Schermen en routes

| Route | Toegang | Doel |
| --- | --- | --- |
| **/** | Iedereen | Zoek op plaats, postcode of straat; zie exacte actieve locaties, verificatiedatum en een zelf geopende route |
| **/kastje-bijwerken/:token** | Alleen wie de geheime persoonlijke link bezit | Werk naam, adres, status en categorieën van één kastje bij |
| **/beheer** | Inloggen als **owner**, **operator** of **viewer** | Bestaande handmatige workflow plus catalogus- en bronbeheer |
| **/beheer → Kastjes** | Ingelogd | Reviewlocaties publiceren, meldingen behandelen, beheerlinks uitgeven of intrekken |
| **/beheer → Bronnen** | Ingelogd | Bronregister met toegangsvorm, toestemmingreferentie, attributie en publicatieregel |

De persoonlijke beheerlink is een bearer token: behandel hem als een wachtwoord. Het token wordt alleen als SHA-256-hash in SQLite bewaard. Het volledige token wordt slechts bij het uitgeven teruggegeven, is standaard 180 dagen geldig (1–365 dagen mogelijk), en een nieuwe link trekt eerdere actieve links voor dat kastje in.

## Website, app en Google Maps

### Voor bewoners

- Zoek op plaats, postcode, straat of kastnaam. Bekijk resultaten als lijst of kaart; de selectie blijft in de URL staan en de terugknop herstelt eerdere filters.
- Filter op **Boeken, Houdbare producten, Kleding, Koelkast, Overig, Speelgoed, Persoonlijke Hygiëne, Planten** of **Aanbod niet bekend**. Meerdere keuzes betekenen: een kastje past bij ten minste één gekozen categorie. Een lege categorie-selectie toont alle soorten.
- Kies via **Meer filters** een provincie en sorteer op plaats/adres of recent gecontroleerd. Alleen actieve, gepubliceerde kastjes verschijnen, ook op de kaart en in exports.
- Categorieën beschrijven wat er **doorgaans** wordt gedeeld. Er is geen live voorraadregistratie, geen openingstijdgarantie, geen filter ‘nu open’ en geen gegarandeerde productbeschikbaarheid.
- Open vanuit een kastje de route in Google Maps. Daar kiest de bewoner zelf het vertrekpunt en vervoermiddel. De website vraagt geen apparaatlocatie op.
- Zet de website op je beginscherm: via de aangeboden installatieknop in ondersteunde browsers, via Safari → Deel → Zet op beginscherm op iOS, of via het browsermenu op Android. De app opent direct de kaartselectie. De kaart wordt pas na een bewuste klik van Google geladen.
- Voor zoeken en kaarten blijft internet nodig. Offline toont de app een herverbindingspagina, geen verouderde catalogus. Beheerlinks en API-antwoorden worden niet door de service worker opgeslagen.

### Wat ‘overlay op Google Maps’ hier betekent

De webapp legt openbare kastjes als selecteerbare spelden op de officiële Google Maps-basiskaart. Een selectie toont adres, gebruikelijk aanbod, verificatiedatum en navigatie. Dit is **geen extensie die zichzelf in de gewone Google Maps-app installeert**, en geen App Store-/Play Store-publicatie.

Voor gebruik binnen Googles bestaande kaartomgeving kun je de gefilterde selectie als **KML** downloaden en op een computer importeren in **Google My Maps**. De export bevat uitsluitend publieke gegevens, bronvermeldingen en een exportdatum. Het is een **momentopname**; opnieuw importeren is handmatig, er is geen automatische My Maps-synchronisatie of Google-accountkoppeling. Zie [Google: bestanden importeren in My Maps](https://support.google.com/mymaps/answer/3024836?hl=en).

De interactieve kaart toont maximaal 2.000 locaties tegelijk en meldt expliciet wanneer de selectie groter is. Verfijn dan op plaats, provincie of aanbod. Een export boven 2.000 locaties of 5 MB wordt geweigerd, niet stil afgekapt. De lijst blijft gepagineerd doorzoekbaar.

### Google Maps activeren

1. Maak of selecteer zelf een Google Cloud-project, activeer **Maps JavaScript API** en koppel facturering. Dit kan kosten meebrengen; de toepassing maakt geen project aan en activeert geen betaling.
2. Maak een browser-API-sleutel. Beperk hem tot de exacte toegestane website-origins en uitsluitend Maps JavaScript API. Gebruik een aparte beperkte sleutel voor localhost-tests.
3. Maak een **JavaScript map ID** voor Advanced Markers. Vul in de repository-root `.env` in:

       VITE_GOOGLE_MAPS_API_KEY=je_beperkte_browser_api_sleutel
       VITE_GOOGLE_MAPS_MAP_ID=je_javascript_map_id

4. Herstart de ontwikkelserver of voer `npm run build` uit en herstart de productieserver. `VITE_`-waarden komen in het publieke browserbestand: gebruik hier **nooit** servergeheimen of provider-tokens.
5. Open de bewonerswebsite → Kaart → Google Maps openen. Controleer de kaart, een speld, filters, route, consolemeldingen en de sleutelbeperkingen op het werkelijke publicatiedomein.
6. Stel quota, budgetmeldingen en bewaking in bij Google. Een budgetmelding is op zichzelf geen harde kostenstop. Zonder geldige sleutel, map ID of Google-toegang blijft de lijst bruikbaar en toont de kaart een duidelijke beperking.

Bij Docker worden deze twee publieke waarden als build-argumenten doorgegeven; `docker compose build app` leest ze uit de root `.env`. Alleen runtime-variabelen wijzigen is onvoldoende. Voor installatie op een telefoon is een stabiele **HTTPS**-website nodig; localhost is alleen een ontwikkeluitzondering. Zie [Google: API instellen](https://developers.google.com/maps/documentation/javascript/get-api-key) en [Advanced Markers](https://developers.google.com/maps/documentation/javascript/advanced-markers/overview).

### Privacy en visuele vormgeving

Google Maps wordt niet op de achtergrond vooraf geladen. De knop legt uit dat openen een verbinding met Google maakt; de kaart gebruikt geen heimelijke apparaatlocatie. De openbare pagina heeft hiervoor een beperkte Google CSP-allowlist; beheer- en persoonlijke tokenpagina’s behouden de strengere standaard. Bronvermelding blijft zichtbaar onder **Bronnen & privacy** en in de KML-export. De buurtkast-illustratie is gegenereerd ter uitleg en is geen foto of bewijs van een bestaande locatie.

## Toegestane bronnen en social media

Een bron werkt pas als **beide** kanten zijn ingericht:

1. de technische invoer staat veilig in **.env** of in een bestand binnen **APP_DATA_DIR**; én
2. in **Beheer → Bronnen** bestaat een ingeschakelde bron met de juiste sleutel, toegangsvorm, toestemmingreferentie, attributie en adresrecht.

Zonder die bronregistratie leest de worker de bron niet in. Dit is opzettelijk fail-closed gedrag.

| Bronregistersleutel | Invoer | Ondersteunde, toegestane route | Niet ondersteund |
| --- | --- | --- | --- |
| **facebook-graph-pages** | Facebook-token, versie en Page-contexten | Alleen expliciet toegestane Facebook Pages via Graph API, alleen lezen | Zoeken door heel Facebook, groepen, privéprofielen, browserautomatisering of posten |
| **nextdoor-approved-export** | **NEXTDOOR_APPROVED_EXPORT_PATH** | JSONL-export waarvoor een beheerder/platform schriftelijke toestemming heeft gegeven | Inloggen bij Nextdoor, een buurtgebied afstruinen of privécontent uitlezen |
| **openstreetmap-pilot** | **OSM_OVERPASS_URL** en begrensde **OSM_PILOT_BBOX** | Kleine Nederlandse pilot met **amenity=give_box** of **food_sharing** én volledige **addr:**-tags | Landelijke blind-run, onbegrensde query of ontbreken van een exact adres |
| **buurtkastjeskaart-export** | **BUURTKASTJESKAART_EXPORT_PATH** | Toegestane JSON/HTML-export van de bestaande kaart | Automatisch gegevens kopiëren van een bron waarvoor geen toestemming bestaat |

### Private groepen

Private groepen zijn niet categorisch uitgesloten, maar alleen bruikbaar als de groepsbeheerder **vooraf schriftelijk** toestemming heeft gegeven en de gegevens via een ondersteunde officiële API of expliciete export worden geleverd. De toestemmingreferentie hoort in het bronregister; sla daar geen wachtwoorden of hele privégesprekken op.

### Facebook

De applicatie kan geen “alle plekken op Facebook” vinden. Dat zou een globale, ongeautoriseerde zoek- of scrapeopdracht zijn. Configureer uitsluitend de Pages waarvoor de eigenaar de benodigde rechten heeft, met een vaste Graph API-versie en een expliciete Page-context. De worker schrijft nooit terug naar Meta.

### Nextdoor-partnerpad

De productgrens is voorbereid voor een later geautoriseerd partnerschap: de bron wordt als **approved_export** of toekomstige officiële API geregistreerd met toestemming, attributie en bronbeleid. Deze repository vraagt geen partner-toegang aan en bevat geen live Nextdoor-credentials.

### OpenStreetMap en naamsvermelding

De OSM-adapter is een optionele, begrensde pilot. Gebruik alleen een HTTPS Overpass-endpoint, een kleine Nederlandse bounding box en registreer een correcte attributie, bijvoorbeeld **© OpenStreetMap contributors — ODbL**. De bewonersvinder toont de opgeslagen attributie van bronnen die bewijs leverden voor zichtbare locaties. Raadpleeg altijd de actuele [OpenStreetMap Copyright and License guidance](https://www.openstreetmap.org/copyright/attribution-guide/) vóór een bredere uitrol.

## Installeren en lokaal starten

### Vereisten

- Node.js **24.22.0 LTS of 26.12.0 current stable** (de production-Docker-image gebruikt 26.12.0)
- npm met het meegeleverde **package-lock.json**
- Windows PowerShell voor de Windows-hulpscripts
- Alleen voor Docker: Docker Desktop

### Ontwikkelmodus

    Copy-Item .env.example .env
    npm ci
    npm run migrate
    npm run dev

Open daarna http://127.0.0.1:5173. De Vite-frontend gebruikt de API op http://127.0.0.1:3000. Maak de eerste eigenaar lokaal aan via **/beheer**.

Start de worker in een tweede terminal wanneer broninname moet draaien:

    npm run worker

Een eenmalige scheduler-/worker-run:

    npm run worker -- --once

Voor CI, een geplande taak of een handmatige eenmalige inname is **npm run ingest** de veilige alias voor precies die governed worker-run. Hij gebruikt uitsluitend het bronregister, de bronpolicy en de PDOK-controle.

    npm run ingest

**npm run ingest:legacy** start alleen de oudere importer/exporter. Die schrijft naar de historische `locations`-tabellen en is niet de bron voor de bewonersvinder; gebruik hem uitsluitend wanneer een bestaande compatibiliteitsafnemer dat expliciet nodig heeft.

### Lokale productiebuild

    npm ci
    npm run build
    npm run migrate
    npm start

De gecompileerde server bedient dan de build in **dist/** en **dist-web/** op standaard http://127.0.0.1:3000.

Op Windows kan **npm.cmd** worden gebruikt wanneer PowerShell lokale npm-shims blokkeert, bijvoorbeeld **npm.cmd run test**.

### Windows-hulpscripts en Docker

De repository bevat daarnaast:

    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\install-windows.ps1
    npm run windows:start
    npm run windows:stop

en een lokale Docker Compose-route:

    docker compose up --build

Lees voor een publiek HTTPS-eindpunt eerst [docs/WINDOWS_AND_NGROK.md](docs/WINDOWS_AND_NGROK.md). De standaard is loopback-only; maak eerste setup nooit via een tunnel of openbare proxy.

## Configuratiereferentie

Kopieer **.env.example**; commit nooit **.env**, echte exports of productiedatabases.

### Runtime, opslag en netwerk

| Variabele | Standaard | Betekenis / bescherming |
| --- | --- | --- |
| **NODE_ENV** | development | development, test of production |
| **HOST**, **PORT** | 127.0.0.1, 3000 | Netwerkbinding; niet-loopback vereist **ALLOW_NETWORK_BINDING=true** |
| **APP_DATA_DIR** | data | Basismap voor database, exports, logs en toegestane invoerbestanden |
| **DATABASE_PATH** | APP_DATA_DIR/weggeefkastjes.sqlite | Moet binnen APP_DATA_DIR blijven |
| **WEB_DIST_PATH** | dist-web | Locatie van de gebouwde React-assets |
| **SESSION_TTL_HOURS** | 24 | Geldigheid van een ingelogde sessie |
| **RATE_LIMIT_PER_MINUTE** | 120 | Limiet voor API-verzoeken; openbare routes hebben ook een eigen begrenzing |
| **TRUST_PROXY** | false | Alleen inschakelen achter een vertrouwde proxy |
| **ALLOW_NETWORK_BINDING** | false | Vereist om buiten loopback te binden |
| **ALLOW_REMOTE_SETUP** | false | Development: eerste setup standaard alleen lokaal; productie: web-setup altijd gesloten, gebruik CLI |
| **COOKIE_SECURE** | afgeleid | In productie verplicht true, ook bij loopback/proxy; vereist HTTPS APP_BASE_URL |
| **APP_BASE_URL** | leeg | Optioneel in development, verplicht HTTPS-origin in productie; volledige beheerlinks gebruiken dit domein |
| **PUBLIC_WORKSPACE_ID** | leeg | UUID van de publieke werkruimte. Zonder deze instelling werkt de bewonersvinder alleen wanneer precies één werkruimte bestaat |
| **WORKER_POLL_MS** | 5000 | Wachttijd als er geen taak gereed is |
| **WORKER_JOB_LEASE_MS** | 300000 | Hersteltermijn voor vastgelopen taken; actieve taken vernieuwen hun lease |
| **BACKUP_INTERVAL_HOURS** | 24 | Interval van de aparte back-upservice; 1–168 uur |
| **BACKUP_KEEP_COUNT** | 14 | Aantal eigen gecontroleerde snapshots; 2–365; handmatige/recoverybestanden blijven behouden |

In productie vereist de configuratie altijd een HTTPS **APP_BASE_URL** en veilige cookies, ook bij een localhost-proxy. De bootstrap gebeurt via `node dist/cli.js bootstrap` met JSON op stdin; zie de productiehandleiding.

### Exacte adrescontrole

| Variabele | Standaard | Gedrag |
| --- | --- | --- |
| **PDOK_LOCATIESERVER_BASE_URL** | https://api.pdok.nl | Alleen de officiële HTTPS-host api.pdok.nl wordt geaccepteerd |
| **PDOK_TIMEOUT_MS** | 5000 | Timeout voor een adrescontrole |

De verifier vraagt de Locatieserver om een adres en accepteert alleen een match waarin genormaliseerde straat+huisnummer, postcode én plaats overeenkomen. Zie de officiële [PDOK Locatieserver-informatie](https://www.pdok.nl/introductie/-/article/pdok-locatieserver-1). Een netwerkfout of onvolledige match is geen vrijbrief: de locatie blijft intern in review.

### Bronnen

| Variabele | Functie |
| --- | --- |
| **FACEBOOK_GRAPH_ACCESS_TOKEN** + **FACEBOOK_GRAPH_API_VERSION** | Moeten samen worden ingesteld voor de officiële Facebook-route |
| **FACEBOOK_PAGE_CONTEXTS_JSON** | JSON-array met alleen goedgekeurde Page-ID’s en context |
| **NEXTDOOR_APPROVED_EXPORT_PATH** | Pad binnen APP_DATA_DIR naar een toegestane JSONL-export |
| **BUURTKASTJESKAART_EXPORT_PATH** | Pad binnen APP_DATA_DIR naar een toegestane JSON- of HTML-export |
| **OSM_OVERPASS_URL** + **OSM_PILOT_BBOX** | Moeten samen worden ingesteld; endpoint moet HTTPS zijn; bbox-volgorde is south,west,north,east en moet volledig binnen Nederland liggen |

De innamebestanden worden lokaal gelezen. Een JSONL-record voor Nextdoor bevat ten minste een korte tekst, observatiemoment en bronnaam; voor een eventuele publicatie zijn vervolgens een volledig adres en PDOK-bevestiging nodig. Voorbeeldbestanden staan onder **data/**.

### Optioneel: HAI-feed en bestaande compatibiliteitspaden

**HAI_FEED_TOKEN**, **HAI_WORKSPACE_ID** en **HAI_PROJECT_KEY** configureren een read-only HAI JSON-feed. **MANUAL_TIPS_PATH**, **SOCIAL_REVIEW_PATH** en **EXPORT_PATH** horen bij de oudere importer/exporter en zijn geen bron voor de openbare bewonersvinder.

## Bronnen veilig activeren

1. Maak in development een lokale eigenaar aan via **/beheer**, of gebruik in productie de veilige CLI-bootstrap uit de productiehandleiding. Bestaande gebruikers/catalogus worden bij overdracht behouden.
2. Zet alleen de technische variabelen voor een bron die echt is toegestaan.
3. Open **Bronnen** en voeg de bron toe met de exacte sleutel uit de tabel hierboven.
4. Vul toegangsvorm, korte toestemming-/licentiereferentie en de publiek vereiste naamsvermelding in.
5. Vink **De toestemming omvat exacte adressen** alleen aan als dat daadwerkelijk vastligt.
6. Kies **Eerst beoordelen** als veilige standaard. Kies **Automatisch na exacte adrescontrole** alleen wanneer de bron actief is én het adresrecht expliciet is vastgelegd.
7. Schakel de bron in, start de worker en controleer **Kastjes** en de audittrail na de eerste run.

De worker plant dagelijkse, idempotente jobs voor geconfigureerde invoer. Een veiligheidstop in **Instellingen** blokkeert providerintake, maar verwijdert geen gegevens.

## API-overzicht

JSON-API-antwoorden hebben de vorm **{ data: ... }**; de KML-export is een XML-download. Beheer-API’s gebruiken cookie-sessies en bij mutaties een CSRF-header. Details, validatiefouten en request-ID’s staan bij fouten onder **error**.

### Openbare routes

| Methode | Route | Resultaat |
| --- | --- | --- |
| GET | **/api/public/locations?query=&page=&limit=** | Alleen actieve én gepubliceerde locaties, zonder bewijs- of bronlink |
| GET | **/api/public/map** | Dezelfde filters, maximaal 2.000 publieke locaties; `total` en `truncated` maken onvolledige dekking expliciet |
| GET | **/api/public/locations.kml** | Gefilterde publieke My Maps-download; HTTP 422 bij meer dan 2.000 locaties of 5 MB |
| GET | **/api/public/locations/:id** | Eén zichtbare locatie |
| GET | **/api/public/attributions** | Alleen naam en naamsvermelding van bronnen die zichtbare locaties onderbouwen |
| POST | **/api/public/locations/:id/reports** | Neemt een korte foutmelding aan en maakt een intern wijzigingsverzoek; verwijdert niets |
| GET / POST | **/api/public/caretaker/:token** | Leest of wijzigt uitsluitend het tokengebonden kastje; POST verifieert het adres opnieuw |

De drie lijst/kaart/export-routes delen `query` (maximaal 240 tekens), herhaalbare `category` (de genoemde categorieën of `unknown`), `province` (een van de 12 provincies; Friesland heet `Fryslân`) en `sort=address|recent`. De lijst accepteert daarnaast `page` (1–100000) en `limit` (1–100; standaard 25). De website gebruikt 12 resultaten per pagina. Ongeldige filterwaarden geven HTTP 400. Voorbeeld: `/api/public/locations?query=Utrecht&category=Boeken&category=Planten`.

### Beheerroutes

| Methode | Route | Bevoegdheid / doel |
| --- | --- | --- |
| GET, POST, PATCH | **/api/sources**, **/api/sources/:id** | Lees bronregister; owner/operator mag bronbeleid wijzigen |
| GET | **/api/resident-locations** | Interne catalogus, inclusief reviewlocaties standaard |
| GET | **/api/resident-locations/:id/events** | Auditbare locatietijdlijn |
| POST | **/api/resident-locations/:id/publish** | Owner/operator publiceert alleen een actieve exact geverifieerde locatie |
| GET, POST | **/api/resident-locations/:id/caretaker-links** | Lijst zonder tokens, of maak één nieuwe persoonlijke link |
| DELETE | **/api/caretaker-links/:id** | Trek een actieve beheerlink in |
| GET | **/api/location-update-requests** | Open, afgehandelde of afgewezen wijzigingsverzoeken |
| POST | **/api/location-update-requests/:id/resolve** | Markeer een verzoek als resolved of dismissed; dit wijzigt geen locatie automatisch |

De al bestaande **/api/items**-routes ondersteunen de aparte, menselijke workflow voor handmatige externe plaatsing. Een “posted”-status daar betekent alleen dat een operator zelf heeft bevestigd dat een bericht is geplaatst; deze workflow is niet de openbare kastjescatalogus.

## Architectuur en data

    React bewonersvinder (/)
              | openbare, rate-limited API
    Express API + statische productie-assets
              |                 |
              |                 +-- beheerportaal (/beheer), cookie + CSRF
              v
    SQLite AppDatabase
      ├── source_registry              bronrechten, attributie en publicatieregel
      ├── resident_locations           exacte, PDOK-bevestigde catalogus
      ├── resident_location_evidence   interne bronbewijzen
      ├── resident_location_events     append-only betekenisvolle mutaties
      ├── location_update_requests     meldingen en reviewwerk
      └── caretaker_tokens             alleen tokenhash, looptijd en intrekking
              ^
              |
    Worker -> toegestane adapters -> PDOK-adresverificatie

De applicatie gebruikt SQLite met migraties, foreign keys, WAL en een busy timeout. Elke beheerdataset is aan een werkruimte gekoppeld. Het publieke endpoint faalt dicht wanneer meerdere werkruimtes bestaan zonder **PUBLIC_WORKSPACE_ID**.

Er bestaan bewust twee oudere/nieuwe paden naast elkaar:

- **src/db/appDatabase.ts**, **src/api/app.ts** en de **resident_**-tabellen vormen de actuele bewonersvinder en het bronregister.
- **src/index.ts**, **src/db/sqlite.ts**, **src/server.ts** en de oude exportfuncties zijn een compatibiliteitspad voor eerdere catalogusimport/export. Alleen **npm run ingest:legacy** roept dat pad nog expliciet aan. **src/server.ts** is loopback-only en mag niet als publieke bewoners-API worden blootgesteld.

Nieuwe openbare functionaliteit moet het eerste pad gebruiken.

## Privacy, veiligheid en gegevensretentie

- Wachtwoorden worden met scrypt gehasht; sessie- en beheerlinktokens worden alleen gehasht opgeslagen.
- Sessiecookies zijn HttpOnly en SameSite=Strict; ingelogde mutaties vereisen CSRF.
- Helmet, een restrictieve CSP, request-ID’s, body-limieten en rate-limiting beschermen de HTTP-laag.
- Providergeheimen blijven server-side. Diagnostiek en publieke routes tonen ze niet.
- Bronbewijs mag intern een korte, noodzakelijke samenvatting en optionele bronlink bevatten. Publieke routes geven die gegevens niet terug.
- Voeg geen namen, telefoonnummers, profielen, foto’s of hele privéposts toe tenzij dat strikt noodzakelijk én toegestaan is; redactie en minimale opslag hebben prioriteit.
- Back-ups, exportbestanden, logs en databasebestanden horen buiten versiebeheer en onder passende bestandstoegang.

Zie [docs/COMPLIANCE_AND_PRIVACY.md](docs/COMPLIANCE_AND_PRIVACY.md) en [docs/SECURITY.md](docs/SECURITY.md) voor de uitgebreide operationele regels.

## Dagelijkse bediening en incidenten

1. Controleer **/ready** en draai **npm run doctor** na een upgrade of storing.
2. Kijk in **Kastjes** naar reviewlocaties en meldingen; een rapport vraagt om beoordeling, geen automatische verwijdering.
3. Controleer in **Bronnen** of toestemming, naamsvermelding en de publicatieregel nog kloppen voordat een bron blijft draaien.
4. Geef een eigenaar een beheerlink in plaats van toegang tot het beheerportaal.
5. Maak regelmatig een online SQLite-back-up met **npm run backup**; herstel alleen met de bevestigde CLI-route.

Bij een incident: schakel de veiligheidstop in, stop de worker, roteer externe credentials indien nodig, maak een back-up, inspecteer de audittrail en hervat pas met een gecontroleerde bronrun. Het volledige draaiboek staat in [docs/OPERATOR_RUNBOOK.md](docs/OPERATOR_RUNBOOK.md).

## Ontwikkelen, testen en releasen

Voer voor een wijziging minimaal uit:

    npm ci
    npm run lint
    npm run typecheck
    npm test
    npm run build

Aanvullend, wanneer relevant:

    npm audit --audit-level=high
    npm run smoke
    npm run doctor
    docker compose config --quiet
    docker build -t weggeefkastje-automation:test .

De tests dekken onder meer adresvalidatie, PDOK-responseverwerking, bronbeleid, cataloguspublicatie, openbare API-isolatie, beheerlink-scope, OSM-pilotvalidatie, worker-idempotentie, sessie/CSRF, werkruimte-isolatie en de bestaande handmatige workflow. Testsucces bewijst geen live Graph API-, Nextdoor-, Overpass-, PDOK- of partneracceptatie; die externe grenzen vereisen operator-eigen toegang en een gecontroleerde run.

Voor elke wijziging aan privacy, bronbeleid, migraties, publieke API of providerintegratie:

1. voeg een gerichte test toe;
2. behoud fail-closed gedrag;
3. draai lint, typecheck, tests en build;
4. controleer minimaal de bewonersroute en de betrokken beheerroute in een browser;
5. werk README, runbook en compliance-documentatie tegelijk bij.

## Repositoriumstructuur

    src/
      adapters/       Toegestane social-, export- en OSM-invoer
      api/            Express API, auth, publieke en beheerroutes
      db/             AppDatabase, legacy catalogus en migraties
      domain/         Validaties en domeintypen
      integrations/   PDOK-adresverificatie en HAI-feed
      jobs/           Workerplanning en broninname
      services/       Catalogusbeslissingen en eigenaarupdates
    web/
      src/            Bewonersvinder, beheerportaal en persoonlijke beheerroute
    tests/            Unit-, database-, worker-, API- en route-tests
    docs/             Compliance, runbook, security, acceptatie en historische audits
    scripts/          Windows-installatie/start/stop en tunnelhulpmiddelen

## Bekende grenzen en wat nog externe acceptatie vereist

- De code en tests valideren de toegestane route, maar er is **geen** live Facebook-token, Nextdoor-partnerschap, private-groepstoestemming, Overpass-endpoint of productie-PDOK-run meegeleverd of geclaimd.
- Een Nederland-brede uitrol vereist per bron een rechtmatige toestemming/licentie en een gefaseerde kwaliteitscontrole. OSM staat bewust als begrensde pilot in de configuratie.
- De kaartintegratie is geïmplementeerd maar vereist een eigen beperkte Google API-sleutel, map ID, facturering en live operatorcontrole. Er is geen native appwinkel-app, bewonersaccount, e-mail/push, uploadfunctie, automatische My Maps-synchronisatie, geautomatiseerd bericht of betaalfunctie.
- Een installatie bevat niet vanzelf een gevulde landelijke catalogus. Rond werkruimte-setup, migraties, rechtmatige bronactivering en inname af voordat je dekking belooft. Testfixtures zijn geen openbare locaties.
- Het product kent geen automatische “gevonden via social media = waarheid”-regel. Maximale dekking is ondergeschikt aan een betrouwbaar exact adres, privacy en buurtvertrouwen.

## Verdere documentatie

| Document | Gebruik |
| --- | --- |
| [docs/COMPLIANCE_AND_PRIVACY.md](docs/COMPLIANCE_AND_PRIVACY.md) | Toestemming, minimale gegevens en publicatieregels |
| [docs/OPERATOR_RUNBOOK.md](docs/OPERATOR_RUNBOOK.md) | Dagelijks beheer, bronactivering, back-up en incidenten |
| [docs/ACCEPTANCE_TESTS.md](docs/ACCEPTANCE_TESTS.md) | Toetsbare product- en veiligheidscriteria |
| [docs/WEBSITE_APP_ACCEPTANCE.md](docs/WEBSITE_APP_ACCEPTANCE.md) | Website/PWA-verificatie, kaartgrenzen en nog benodigde live acceptatie |
| [docs/DISCOVERY_IMPORT_2026-09-05.md](docs/DISCOVERY_IMPORT_2026-09-05.md) | Werkelijke lokale internetimport: 86 locaties, 1.864 kandidaten, bronrechten, dekking en herstel |
| [docs/DISCOVERY_VERIFICATION_2026-09-05.md](docs/DISCOVERY_VERIFICATION_2026-09-05.md) | Eerste verificatieronde: twee adrescorrecties, 88 publieke locaties en resterende onzekerheden |
| [docs/VERIFICATION_WORKFLOW.md](docs/VERIFICATION_WORKFLOW.md) | Vondsten onderzoeken in het beheer: zoeken, paginering, bronbewijs, ontbrekende controles, notitiehistorie en veilige import |
| [docs/SECURITY.md](docs/SECURITY.md) | Dreigingsmodel, controles en restrisico |
| [docs/WINDOWS_AND_NGROK.md](docs/WINDOWS_AND_NGROK.md) | Windows- en tunneldeployment |
| [docs/HAI_INTEGRATION.md](docs/HAI_INTEGRATION.md) | Read-only HAI-feed |

Dit pakket is **private** en bevat geen licentiebestand. Hergebruik of publicatie valt buiten deze README en vereist toestemming van de repository-eigenaar.
