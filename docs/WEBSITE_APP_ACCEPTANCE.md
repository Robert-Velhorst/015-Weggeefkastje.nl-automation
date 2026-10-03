# Website en webapp — verificatie 5 september 2026

## Geleverde uitvoering

De bestaande React/Express/SQLite-toepassing is uitgebreid, niet vervangen. De bewonerswebsite heeft een mobiel ontwerp, zoeken op locatie, gebruikelijke-aanbodfilters, provincie, sortering, paginering, deelbare URL-selecties, foutafhandeling en meldingen. De eigenaarroute gebruikt dezelfde uitstraling en kan categorieën bijwerken zonder onbekende bestaande labels stil te verliezen.

De app is een PWA met manifest, appiconen, browserinstallatie en een gerichte offline-pagina. De Google Maps-koppeling gebruikt Advanced Markers na een bewuste gebruikersactie. Het is geen uitbreiding van de gewone Google Maps-app. Een gefilterde, gedateerde KML-export biedt een handmatig My Maps-importpad.

## Lokale verificatie

- `npm test -- --pool=threads --maxWorkers=1`: **23 testbestanden, 55 tests geslaagd**. Dit is dezelfde volledige suite met één thread-worker; de standaard fork-runner had op deze Windows-host incidentele startproblemen. De bestaande ingest-procestests kregen een buitenste deadline van 30 seconden, passend bij hun al bestaande 20-secondenproceslimiet. De subprocesscontrole is niet afgezwakt.
- `npm run typecheck`, `npm run lint`, `npm run build`: geslaagd.
- `npm audit --audit-level=moderate`: geen gerapporteerde kwetsbaarheden. De transitieve `qs`-versie is bijgewerkt binnen de bestaande dependency-range.
- `docker compose config --quiet` en `git diff --check`: geslaagd. Dit is geen bewijs van een nieuwe Docker-imagebuild of productie-uitrol.
- Browser: desktop 1440 px en mobiel 390 px; geen horizontale pagina-overloop. Zoek- en filterstatus, terugnavigatie, kaart-zonder-configuratie en KML-download gecontroleerd.
- Een afzonderlijke, uitsluitend lokale fixture-database bevatte 15 duidelijk als test gemarkeerde locaties. De browser toonde 12 + 3 resultaten over twee pagina's en 7 na het plantenfilter. Een publieke melding liet de 7 actieve locaties intact. Deze fixtures zitten niet in de productiedatabase of versiebeheer.
- Offline in een geïsoleerde browsercontext: de opgemaakte herverbindingspagina verschijnt; cache bevat uitsluitend `/offline.html` en `/offline.css`; terug online en opnieuw openen herstelt de bewonerspagina.
- De Google SDK-grens is in componenttests gesimuleerd. Tests controleren toestemming vóór laden, coördinaten, markerselectie, opruimen van oude markers, authenticatiefouten en behoud van een geopende kaart tijdens filteren. Dit is **geen live Google-kaarttest**.
- Een API-regressietest controleert dat alleen `/` een Google-compatibele referrerpolicy krijgt, terwijl beheer- en tokenroutes `no-referrer` en hun strengere CSP behouden.
- Een onafhankelijke read-only review vond twee kaartintegratieproblemen; beide zijn hersteld en met eerst falende, daarna slagende regressietests gecontroleerd. Geen resterende blokkerende bevindingen in die reviewscope.

## Nog te accepteren met echte toegang

1. Operator configureert een eigen Google-project, facturering, uitsluitend voor Maps JavaScript toegestane browserkey en JavaScript map ID. Daarna herbouwen en testen op het werkelijke HTTPS-domein, inclusief beperking van de key, Google-netwerk/CSP-gedrag, pins en navigatie.
2. Installatie op echte Android- en iOS-toestellen controleren. Browseremulatie, een manifest en een geregistreerde service worker bewijzen geen fysieke telefooninstallatie of appwinkelpublicatie.
3. Alleen indien gewenst en geautoriseerd: export handmatig in een private Google My Maps-testkaart importeren. Automatische synchronisatie is niet geïmplementeerd of geclaimd.
4. Een echte bewonerscatalogus opbouwen via toegestane bronnen en exacte adresvalidatie. De aanwezige oudere lokale database bevatte bij inspectie nog geen `resident_locations`-tabel; die database is tijdens deze website-opdracht niet gemigreerd of gevuld.
5. Hosting/publicatie apart uitvoeren. Er is geen domein gepubliceerd, geen Google-account gewijzigd en geen betaalde dienst geactiveerd in deze opdracht.

Bij een wijziging aan offline-assets moet ook de service-worker-versie worden aangepast zodat bestaande installaties de nieuwe fallback ophalen. Zie de root-README voor configuratie en het operator-runbook voor releasecontroles.
