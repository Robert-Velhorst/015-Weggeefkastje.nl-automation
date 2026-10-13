# Vondsten verifiëren in het beheer

Open `/beheer`, log in met een bestaand beheeraccount en kies **Kastjes → Vondsten verifiëren**. Onderzoek is alleen zichtbaar voor ingelogde leden van dezelfde werkruimte. Er is geen nieuw account nodig en er zijn geen standaardwachtwoorden toegevoegd.

## Voor beheerders

- Zoek op plaats, straat, titel, bronnummer of woorden uit onderzoeksnotities. Een zoekgebied uit een nabijgelegen BAG-adres is nadrukkelijk geen bevestigd kastadres.
- Filter op openstaande/afgehandelde/niet overgenomen meldingen en op de aanwezigheid van onderzoeksnotities. **Met notities** omvat ook eerste screenings; het betekent niet **geverifieerd**.
- Blader door alle resultaten, 25 per pagina. Het getoonde totaal hoort bij de volledige selectie, niet alleen bij de eerste 100 meldingen.
- Bekijk het oorspronkelijke bronbewijs, de nieuwste bevindingen, wat nog moet worden gecontroleerd en de bijbehorende bronlinks. Oudere notities blijven uitklapbaar beschikbaar.
- Eigenaren en operators kunnen een nieuwe onderzoeksnotitie toevoegen. Kijkers kunnen alleen lezen. Leg noodzakelijke locatiegegevens vast, geen overbodige persoonlijke gegevens of toegangscodes.
- **Een notitie opslaan publiceert niets, verandert geen adres en sluit geen melding af.** Ook de uitkomst “Adrescorrectie gecontroleerd” is slechts een onderzoeksnotitie, geen vervanging van de bestaande BAG-publicatieroute.
- Het apart afsluiten van een melding behoudt de oorspronkelijke melding en de notities. “Afgehandeld” betekent niet dat een nieuwe locatie gepubliceerd is.

## Wat voldoende bewijs vraagt

Beoordeel afzonderlijk: exact bezoekersadres, bestaan van het kastje, actuele toegankelijkheid, gebruikelijk aanbod en toegestane bronverwerking. Een gewone woning of organisatie op dezelfde plek bewijst geen kastje. Een OSM-spiegel is geen onafhankelijke bevestiging. Een gevonden website, geldige postcode of recente download bewijst op zichzelf geen actuele fysieke aanwezigheid of hergebruikstoestemming.

De publieke catalogus blijft door de bestaande bron- en adrescontroles beschermd. Onderzoeksnotities worden niet aan de publieke API, kaart of KML toegevoegd. Deze uitbreiding verstuurt geen berichten, vraagt geen toestemmingen aan en activeert geen sociale connectoren.

## Voor ontwikkelaars

- Migratie **7** voegt uitsluitend `location_verification_notes` en een index toe. Oorspronkelijke verzoeken en locaties blijven behouden.
- `GET /api/location-update-requests`: bestaande statusselectie plus `page`, `limit` (1–100), `query` (maximaal 160 tekens) en `researched=all|yes|no`. Antwoord: `{data:{items,total,page,limit}}`; elk item heeft `verificationNotes`, nieuwste registratie eerst. De standaardlimiet blijft 100 voor bestaande afnemers.
- `POST /api/location-update-requests/:id/verification-notes`: bestaande sessie, CSRF-token en rol `owner`/`operator` vereist. Invoer: `outcome`, `findings`, `remainingChecks`, optioneel `searchArea` en `sourceUrls`, en ISO-UTC `checkedAt`. Zie `src/domain/verificationNote.ts` voor limieten en toegestane uitkomsten.
- De opgeslagen onderzoeksinhoud wordt op hash ontdubbeld binnen dezelfde melding/werkruimte. Een echte nieuwe notitie blijft een nieuwe historievermelding met actor, registratiedatum en audit-event `resident_request.verification_noted`. Er is geen update- of verwijderroute voor losse notities.
- Alleen HTTP(S)-bronlinks zonder ingebedde inloggegevens zijn toegestaan; de server bezoekt deze links niet. React toont onderzoeksinhoud als tekst, niet als HTML.
- De zoekopdracht telt en pagineert op de server. Notities worden voor de resultatenpagina in één aanvullende databasequery opgehaald. Een afgebroken of verouderd browserverzoek overschrijft geen nieuwere zoekresultaten.

## Onderzoeksimport

`scripts/import-verification-notes.ts` koppelt het bestaande lokale register met 206 kandidaten en de 13 aanvullende onderzoeken uit `docs/research/2026-09-05-gouda-zeeland-verification.json` aan de oorspronkelijke OSM-verzoeken. Het script vereist beide bronbestanden en een expliciet bestaand databasepad. De 206-kandidatenexport staat lokaal onder `data/exports/` en wordt vanwege gegevensscheiding niet automatisch via Git verspreid.

```powershell
node --import tsx scripts/import-verification-notes.ts qa/verification-ui-20260905.sqlite
# Pas na controle van de proefimport:
node --import tsx scripts/import-verification-notes.ts data/weggeefkastjes.sqlite
```

Voor iedere uitvoering wordt vóór migratie een consistente SQLite-back-up gemaakt. Het script controleert de bron-ID-koppelingen, weigert dubbelzinnige mappings, valideert alle notities en controleert na afloop dat de oorspronkelijke locaties en verzoeken volledig ongewijzigd zijn. Een herhaling van dezelfde bronbestanden voegt niets dubbel toe. Een onderbroken import is opnieuw uitvoerbaar; eerder opgeslagen notities blijven bewaard. Wijzigingsrapporten staan onder `data/exports/osm-verification-2026-09-05/notes-import-*.json`.

Back-ups bevatten interne gegevens. Publiceer ze niet en overschrijf geen draaiende SQLite-database voor herstel. Browserproeven gebruiken een aparte databasekopie; testnotities worden nooit naar de hoofdcatalogus geïmporteerd.

Aanvullende beoordeelde rondes kunnen als extra JSON-pad worden meegegeven. Iedere ronde bevat unieke `sourceRecordId`-waarden uit de oorspronkelijke 206 kandidaten en een `input` per geval volgens `verificationNoteSchema`. Validatie vindt plaats vóór databasewijzigingen. Andere metadata (zoals zoekopdrachten en BAG-bewijs) blijft in het onderzoeksbestand; de import slaat alleen de expliciete notitie op. Zonder extra pad blijft de oorspronkelijke import ongewijzigd werken.

```powershell
node --import tsx scripts/import-verification-notes.ts qa/verification-round-20260906.sqlite docs/research/2026-09-06-putten-heerenveen-nijkerk-verification.json
# Pas na controle van de proefimport:
node --import tsx scripts/import-verification-notes.ts data/weggeefkastjes.sqlite docs/research/2026-09-06-putten-heerenveen-nijkerk-verification.json
```

## Testdekking en grenzen

### Uitgevoerd op 6 september 2026

Vijftien aanvullende onderzoeken zijn opgeslagen: Putten (5), Heerenveen (3), Nijkerk (4) en Nijkerkerveen (3). De database bevat **234 notities bij dezelfde 206 kandidaten**; **158** hebben nog uitsluitend een eerste screening. Dit is geen telling van volledig geverifieerde of publiceerbare kastjes.

- Vijf gevallen hebben een rechtstreeks gelezen locatie- of organisatiepagina met expliciet adres, zonder vastgestelde recente fysieke controle.
- Eén geval, De Potgieter, heeft zo'n pagina maar een afwijkende bronpostcode: **3881 WL** tegenover **3881 WN** in BAG. Dat verschil blijft zichtbaar als tegenstrijdig bewijs.
- Twee gevallen in Nijkerkerveen hebben alleen historische adresbevestiging. Een opening of voorgenomen vervanging in 2022 bewijst geen aanwezigheid in september 2026.
- Zeven gerichte webonderzoeken leverden geen onafhankelijke kastjesbevestiging op. Hun nabijgelegen BAG-adressen blijven uitsluitend zoekcontext; de zoekopdrachten staan in het onderzoeksbestand. Geen resultaat is geen bewijs van afwezigheid.

Voor de acht expliciet genoemde adressen is een unieke exacte straat-huisnummer-woonplaatsmatch bij PDOK/BAG gevonden. De antwoorden met URL en raadpleegtijd staan lokaal in `data/exports/osm-verification-2026-09-06/bag-exact-checks.json`. BAG bevestigt adressen, niet kastjes. De datakwaliteitswerkwijze houdt die bewijssoorten, actualiteit en ontbrekende controles apart. [Bevindingen en bronlinks per kandidaat](research/2026-09-06-putten-heerenveen-nijkerk-verification.json).

Er zijn **nul nieuwe publicaties**: de catalogus blijft 88 actieve gepubliceerde locaties en de wachtrij 1.862 openstaande plus twee afgehandelde verzoeken. Voor aanvullende bronnen is hergebruikstoestemming niet vastgesteld; PuttenCity verlangt voorafgaande toestemming voor overname. Er zijn geen contactverzoeken verstuurd, sociale accounts gebruikt of bronregels versoepeld.

Verificatie: consistente proefkopie; eerste import +15 notities, herhaling +0; echte import +15; alle vijftien opgeslagen notities exact vergeleken met de invoer. De volledige oorspronkelijke locaties, verzoeken en bronregistraties zijn identiek aan de back-up. SQLite-integriteit `ok`, nul foreign-key-fouten. Vier gerichte API-tests en lint zijn geslaagd. Geen nieuwe browser-schrijfproef of volledige build uitgevoerd voor deze onderzoeksronde. Er is niets gecommit, gepusht of extern gedeployd.

Back-up vóór de echte import: `data/backups/pre-verification-notes-2026-09-05T22-43-04-157Z.sqlite`. Rapport: `data/exports/osm-verification-2026-09-05/notes-import-2026-09-05T22-43-04-157Z.json`. Bestandsnamen gebruiken UTC; de uitvoering viel op 6 september in Nederland. De eerdere resultaten hieronder zijn historische momentopnamen.

### Uitgevoerd op 5 september 2026

De echte lokale database bevat nu **219 onderzoeksnotities bij 206 vondsten**. De aanvullende ronde onderzocht **13** eerder alleen gescreende kandidaten in Gouda en Zeeland: vijf hebben actuele bronnen met expliciete adressen, twee hebben historische of tegenstrijdige informatie over het voortbestaan, twee hebben alleen straatniveau-bevestiging en vier leverden geen onafhankelijke kastjesbron op. Geen daarvan is in deze ronde gepubliceerd. Er blijven **173** kandidaten uit de geselecteerde groep over waarvoor alleen de eerste screening is afgerond, naast andere nog openstaande controles.

De publieke API bevat nog steeds **88 locaties**. Er zijn **1.862 openstaande** en twee eerder afgehandelde verzoeken. De import heeft die statussen en alle oorspronkelijke locatierecords ongewijzigd gelaten. Er zijn nul QA-testnotities in de echte database. SQLite-integriteit is `ok`, zonder foreign-key-fouten. De consistente back-up vóór de import heet `data/backups/pre-verification-notes-2026-09-05T21-10-54-931Z.sqlite`; het bijbehorende rapport staat in de genoemde exportmap.

Alle **62 tests in 25 bestanden**, typecontrole, lint en server/web-build zijn geslaagd. De afzonderlijke code-review vond geen noodzakelijke correcties. Browsercontrole op de databasekopie: werkende beheerpagina, zoeken naar Gouda (zeven resultaten), oorspronkelijke bronnen en historie zichtbaar, notitie opslaan zonder publicatie, nul consolewaarschuwingen of -fouten. Desktop (1365 × 1000) en mobiel (390 × 844) zijn visueel gecontroleerd; mobiel heeft geen horizontale overloop. Browser gebruikte Playwright omdat de Browser-plugin met bijbehorende browser-skill niet beschikbaar was. De echte site draait lokaal op poort 3195; de ingelogde schrijfproef is uitsluitend op de kopie op poort 3196 uitgevoerd. Er is niets gecommit, gepusht of extern gedeployd.

De API-tests controleren zoeken/paginering na het honderdste resultaat, historie, ontdubbeling, behoud van meldingsstatus, geen onbedoelde publicatie, sessie- en CSRF-eisen, werkruimtescheiding, kijkerrechten en onveilige URL's. De componenttests controleren bevindingen/bronlinks, volledige telling, volgende pagina en het opslaan van een notitie.

Dit is een beheeruitbreiding en een volgende onderzoeksronde, geen voltooide verificatie van alle kandidaten. Het bestaande blok met gepubliceerde locaties onder de onderzoekswachtrij toont nog maximaal 100 locaties; dat maximum wordt nu expliciet vermeld. Alleen de onderzoekswachtrij is in deze wijziging volledig doorbladerbaar gemaakt.
