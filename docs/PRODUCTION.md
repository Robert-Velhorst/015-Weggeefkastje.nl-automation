# Productie-installatie en beheer

Deze handleiding is de operationele route voor één HTTPS-installatie op één Linux-host met lokale, duurzame opslag. `docker-compose.yml` blijft de lokale ontwikkelinstallatie; gebruik voor een openbare website uitsluitend `compose.production.yml`.

## Wat wordt geïnstalleerd?

- **Caddy** ontvangt HTTP/HTTPS op poort 80/443, verzorgt certificaten en stuurt door naar de webserver.
- **App** serveert de gebouwde bewonerswebsite, PWA, beheeromgeving en API. De app-poort wordt niet op de host gepubliceerd.
- **Worker** verwerkt duurzame, toegestane brontaken. Een verlopen taaklease wordt hernomen met een begrensd aantal pogingen. Invoer is idempotent; dit is een at-least-once-taakmodel, geen exactly-once-belofte voor externe diensten.
- **Back-upservice** maakt bij starten en daarna standaard iedere 24 uur een SQLite-snapshot via de online backup-API, controleert integriteit en foreign keys, schrijft een SHA-256-checksum en bewaart standaard 14 snapshots. Alleen eigen, herkende snapshots met checksum worden geroteerd.
- **app-data-volume** bevat de echte database, exports, runtime-heartbeats en back-ups; Caddy heeft aparte volumes voor certificaten/configuratie.

App, worker en back-upservice gebruiken dezelfde release-image, draaien zonder root, met alleen-lezen root-filesystem, zonder Linux-capabilities, met begrensd geheugen en roterende containerlogs. Alleen `/app/data` en een begrensde tijdelijke map zijn schrijfbaar.

## Beslissingen vóór livegang

De operator moet het domein, de host, DNS en eventuele Google Maps-accountkosten bepalen. Dit bestand registreert geen domein, huurt geen server en activeert geen betaalde API. Gebruik een ondersteunde Linux-host met Docker Engine en Compose v2+, minimaal 2 CPU's en 2 GB RAM als startpunt; meet capaciteit op de echte host. De image gebruikt Node 24. Gebruik lokale block storage, geen NFS/SMB voor SQLite WAL.

DNS A/AAAA moeten naar deze host wijzen. Alleen SSH (beperkt tot beheerders), 80/tcp en 443/tcp moeten bereikbaar zijn; 443/udp is optioneel voor HTTP/3. Poort 3000 wordt niet publiek aangeboden. Zet niet zonder configuratiecontrole nog een CDN/reverse proxy vóór Caddy: Express vertrouwt precies één proxyhop.

Bronnen moeten schriftelijk/technisch toegestaan zijn. Een adrescontrole bewijst een adres, niet dat er vandaag nog een kastje staat. Controleer de actuele catalogus, toestemmingen en bronlicenties vóór publicatie; open wijzigingsverzoeken zijn geen geverifieerde locaties.

## 1. Release voorbereiden

Werk vanuit een gecontroleerde checkout. Bewaar de exacte Git-revisie, lockfile en vorige image-tag. Voer uit:

```sh
npm ci
npm audit
npm run lint
npm run typecheck
npm test
npm run build
npm run smoke:production
```

De smoke-test gebruikt een aparte tijdelijke database met synthetische gegevens. Hij start de **gebouwde** server, bootstrapt via stdin, controleert public filtering/privacy, meldingen, login/CSRF, herstartpersistentie, de gebouwde worker, een gecontroleerde back-up en uitloggen. Hij doet geen Facebook/Nextdoor/PDOK-aanvragen en bewijst geen HTTPS-certificaat.

Kopieer `.env.production.example` naar `.env.production`, beperk leesrechten (`chmod 600 .env.production`) en vul in:

| Instelling | Betekenis |
| --- | --- |
| `APP_DOMAIN` | Alleen hostname van het echte domein, zonder protocol/pad |
| `APP_VERSION` | Unieke, onveranderlijke release-tag; hergebruik die nooit voor andere code |
| `PUBLIC_WORKSPACE_ID` | De bestaande of nieuw aangemaakte workspace-UUID; verplicht bij meerdere workspaces |
| `BACKUP_INTERVAL_HOURS`, `BACKUP_KEEP_COUNT` | Interval 1–168 uur, retentie 2–365 snapshots; standaard 24/14 |
| `WORKER_JOB_LEASE_MS` | Standaard 300000 ms; de worker vernieuwt actieve leases periodiek |
| Providerwaarden | Alleen echt geautoriseerde toegang; exportpaden liggen binnen `/app/data` |
| `VITE_GOOGLE_MAPS_*` | Optionele, publiek zichtbare, oorsprong/API-beperkte browserconfiguratie; wijziging vereist rebuild |

Compose dwingt productie, secure cookies, HTTPS-base-URL, uitgeschakelde demo en uitgeschakelde web-bootstrap af. De productieconfig weigert HTTP, ook achter een localhost-proxy. Wachtwoorden en providercredentials horen nooit in build-args, Git, screenshots of supporttickets.

Gebruik in alle volgende commando's dezelfde Compose-projectnaam en hetzelfde env-bestand:

```sh
docker compose --env-file .env.production -f compose.production.yml config --quiet
docker compose --env-file .env.production -f compose.production.yml build app
```

## 2. Nieuwe installatie initialiseren

Gebruik dit alleen voor een **nieuwe, lege** installatie. Bestaande gegevens eerst overzetten volgens de volgende sectie; maak geen vervangende lege catalogus.

Geef de initialisatie-JSON via stdin uit een veilige lokale bron. Velden: `email`, `password` (12–200 tekens), `displayName`, `workspaceName`. Gebruik geen wachtwoord als command-line argument. Bescherm een eventueel invoerbestand met 0600 en verwijder het na acceptatie volgens het eigen wachtwoordbeheerbeleid.

```sh
docker compose --env-file .env.production -f compose.production.yml run --rm -T app node dist/cli.js bootstrap < /secure/setup.json
```

Het commando toont alleen user/workspace-ID's en weigert een tweede bootstrap. Vul de geretourneerde workspace-UUID in `PUBLIC_WORKSPACE_ID` in. De publieke `/api/setup`-route blijft in productie gesloten, ook vanaf localhost.

## 3. Bestaande catalogus behouden

Maak op de bestaande installatie met `npm run backup` een consistente snapshot **plus** bijbehorende `.sha256`. Bewaar een tweede kopie buiten deze host voordat je migreert. Kopieer nooit alleen een open `.sqlite`-bestand: actuele transacties kunnen nog in het WAL-bestand staan.

Plaats de gecontroleerde overdracht op de doelhost in een privémap, bijvoorbeeld `/secure/transfer/`, met bestanden `import.sqlite` en `import.sqlite.sha256`. Stop app, worker en back-upservice. Initialiseer het volume met `run --rm app node dist/cli.js migrate`; dat maakt alleen de schema's. Kopieer daarna de snapshot en checksum met een eenmalig read-only hostmount naar `/app/data/backups/`:

```sh
docker compose --env-file .env.production -f compose.production.yml stop app worker backup
docker compose --env-file .env.production -f compose.production.yml run --rm -T app node dist/cli.js migrate
docker compose --env-file .env.production -f compose.production.yml run --rm -T -v /secure/transfer:/transfer:ro app node -e "const f=require('node:fs');f.mkdirSync('/app/data/backups',{recursive:true,mode:448});for(const n of ['import.sqlite','import.sqlite.sha256'])f.copyFileSync('/transfer/'+n,'/app/data/backups/'+n)"
docker compose --env-file .env.production -f compose.production.yml run --rm -T app node dist/cli.js restore --from /app/data/backups/import.sqlite --confirm --confirm-services-stopped
docker compose --env-file .env.production -f compose.production.yml run --rm -T app node dist/cli.js doctor
```

Herstel controleert de bron en checksum (indien aanwezig), migreert en valideert een stagingkopie en maakt een recovery-snapshot vóór vervanging. De vorige database/WAL-bestanden blijven ook bewaard met een unieke `.pre-restore-*`-naam. Een schema dat nieuwer is dan de release wordt geweigerd. De operator moet alle processen werkelijk stoppen; een checkpoint alleen bewijst niet dat er geen andere verbinding meer is.

Controleer na overdracht gebruikers, workspace-ID, aantallen actieve gepubliceerde kastjes, open meldingen, bronregels en audittrail tegen de broninstallatie. Oude caretakerlinks hebben dezelfde tokens/expiry maar moeten via het nieuwe domein worden geopend. Een bestaande Google Maps-browserkey moet toestemming voor het nieuwe domein hebben.

## 4. Starten en echte acceptatie

```sh
docker compose --env-file .env.production -f compose.production.yml up -d
docker compose --env-file .env.production -f compose.production.yml ps
docker compose --env-file .env.production -f compose.production.yml exec -T app node dist/cli.js doctor
```

Alle drie appdiensten moeten healthy worden. De app-readiness vereist een bereikbaar, gemigreerd schema, een beheerder, een gebouwde website en een eenduidige publieke workspace. Healthchecks tellen niet mee voor gebruikers-rate-limits.

Test op het **echte** domein:

1. HTTP wordt HTTPS, certificaat geldig, `/health` en `/ready` geven 200, app-poort extern gesloten.
2. Bewonerspagina op desktop en mobiel: zoeken, categorie/provinciefilters, leeg resultaat, routes, KML-export en bronvermelding. Google wordt pas na de gebruikersactie geladen; toets kaartmarkers/filters met de echte, beperkte key als de overlay wordt aangeboden.
3. `/beheer`: inloggen, opnieuw laden, catalogus/bronregister bekijken, één gecontroleerde wijziging, auditlog, uitloggen. Cookie heeft `Secure`, `HttpOnly`, `SameSite=Strict`; schrijven zonder CSRF faalt.
4. Persoonlijke eigenaar-link privé openen, beperkte locatie lezen, gecontroleerde wijziging met echte PDOK bevestigen, intrekken en verlopen link controleren. Deel token niet in screenshots/logs.
5. App en worker herstarten; gegevens blijven behouden. Worker en back-upservice blijven healthy; een snapshot en checksum zijn aanwezig.
6. Restore-repetitie op een **aparte** installatie met een echte snapshot, aantallen en integriteit vergelijken. Geen productie-restore als oefening.
7. Alleen geautoriseerde providers apart live testen; ontbrekende credentials/export of partneracceptatie zijn geen geslaagde integratie.

## Monitoring en privacy

Monitor buiten deze host `/ready` (bijv. iedere minuut), containerstatus, vrije schijfruimte en de leeftijd van de nieuwste gecontroleerde back-up. Leg een verantwoordelijke en meldingskanaal vast. Compose restart helpt bij procesuitval, maar een *unhealthy* container wordt door Docker niet automatisch herstart: onderzoek en herstel die.

App-logs bevatten request-ID, methode, route-template, status en duur; geen raw URL, body, cookie of query. Providerfouten worden generiek opgeslagen om tokens in URL's niet te lekken. Workerlogs tonen task-ID/type/poging. Caddy accesslogging is bewust niet geactiveerd wegens bearerlinks; request-objecten/URI's worden ook uit operationele logs gefilterd. Voeg alleen token-veilige logging toe.

Back-ups op hetzelfde volume beschermen niet tegen host-/volumeverlies. Kopieer versleutelde snapshots en checksums periodiek naar een onafhankelijk doel, beperk toegang en toets herstel. De standaard 24 uur betekent maximaal circa één interval gegevensverlies bij herstel van alleen snapshots; een strengere RPO/RTO vereist aangepast interval, externe opslag en gemeten herstel. Regel alerts/off-hostback-up vóór livegang; dit project neemt geen externe opslagabonnementen of meldingen over zonder configuratie.

## Updates en rollback

Maak vóór iedere release een online back-up, bewaar die buiten de automatische rotatie met de oude image-tag/Git-revisie. Stop worker/back-upservice, pas `APP_VERSION` aan, bouw de app-image en start de nieuwe release. Controleer `/ready`, `doctor`, bronstatus en de bewoners-/beheerroute. Bewaar de vorige image lokaal of in een private registry; gebruik geen `docker compose down -v`.

Bij een probleem zonder schemawijziging kan de vorige image met dezelfde database worden gestart. Bij een schemawijziging: stop app/worker/backup, gebruik de vorige release-image en herstel de bijbehorende **voor-migratie**-snapshot. Een oudere release mag een nieuwer schema niet openen. Herstel verliest wijzigingen na de snapshot: stem dat af en bewaar de nieuwere database voor reconciliatie. Draai niet blind een oude image op een nieuw schema.

Verwijder pas na acceptatie specifieke recoverybestanden, en alleen na onafhankelijke back-up. Rotatie verwijdert alleen door de back-upservice herkende oudere snapshots; handmatige import/recoverybestanden vallen daar buiten.

## Grenzen en primaire technische referenties

Dit is één host met SQLite; geen high-availability cluster of bewezen landelijke piekcapaciteit. Providerautorisatie, actuele kastjes, Google billing/key, DNS, TLS, off-host-back-ups, alerts en hostveiligheid moeten op de gekozen infrastructuur worden geaccepteerd. Een lokale groene test is geen livegangbewijs.

- [SQLite online backup](https://www.sqlite.org/backup.html): consistente snapshots tijdens gebruik.
- [SQLite WAL](https://www.sqlite.org/wal.html): lokale filesystemvereiste en het belang van WAL/checkpoints.
- [Docker Compose in production](https://docs.docker.com/compose/how-tos/production/): aparte productiedeployment en servicebeleid.
- [Caddy reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy): forwarding/trusted-proxygedrag; houd de ingestelde hopgrens intact.

Zie ook [OPERATOR_RUNBOOK.md](OPERATOR_RUNBOOK.md), [SECURITY.md](SECURITY.md) en [COMPLIANCE_AND_PRIVACY.md](COMPLIANCE_AND_PRIVACY.md).
