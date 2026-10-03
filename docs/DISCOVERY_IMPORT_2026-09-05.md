# Internetvondsten en catalogusimport — 5 september 2026

## Resultaat en reikwijdte

Een eenmalige landelijke OpenStreetMap-zoekactie leverde **1.951 bronobjecten** op. Daarvan zijn **86 unieke locaties** toegevoegd aan de bestaande lokale catalogus, **1.864 kandidaten** in de niet-openbare beoordelingslijst gezet en **1 locatie** met uitsluitend klantentoegang uitgesloten. Dit is **geen volledige inventarisatie van alle Nederlandse buurtkastjes** en geen bevestiging van actuele voorraad, openingstijden of fysieke aanwezigheid.

De website op `http://127.0.0.1:3195/` gebruikt nu `data/weggeefkastjes.sqlite`, niet de lege tijdelijke database `qa/website-preview.sqlite`. De bestaande werkruimte en eigenaar zijn behouden. Het betreft lokale gegevens; er is niets naar een publieke hostingomgeving of GitHub gepusht.

| Controle | Uitkomst |
| --- | ---: |
| OSM `amenity=give_box` | 190 |
| OSM `amenity=food_sharing` | 10 |
| OSM `amenity=public_bookcase` | 1.751 |
| Bron vermeldt straat én huisnummer | 95 |
| Gepubliceerd na echte PDOK/BAG-controle | 86 |
| Beoordeling: exact adres ontbreekt | 1.855 |
| Beoordeling: adres niet exact bevestigd | 8 |
| Beoordeling: adresaanvulling niet eenduidig | 1 |
| Uitgesloten: beperkte toegang | 1 |

Van de 86 openbare locaties zijn er 83 minibiebs, één is als koelkast gecategoriseerd en bij twee is het aanbod onbekend. De herkomsttypen van die laatste drie zijn twee voedseldeelpunten en één weggeefpunt. Er is geen voedselvoorraad of houdbaarheid afgeleid uit het enkele label `food_sharing`.

De openbare selectie is geografisch scheef: Utrecht 73, Zuid-Holland 8, Noord-Holland 4, Noord-Brabant 1. Dat komt door de beperkte adresvolledigheid in deze bron. De landelijke zoekopdracht betekent dus niet dat de openbare selectie landelijke dekking heeft.

## Bronnen en toestemming

- [OpenStreetMap](https://www.openstreetmap.org/copyright): hergebruik onder ODbL 1.0 met bronvermelding en toepasselijke gelijkdelenvoorwaarden. De bron is geregistreerd als `openstreetmap-nl-discovery`, ingeschakeld voor automatische publicatie na adrescontrole.
- [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API): één landelijke, begrensde alleen-lezenvraag aan `https://overpass-api.de/api/interpreter`; geen herhaald opvragen van dezelfde dataset.
- [PDOK Locatieserver](https://www.pdok.nl/restful-api/-/article/pdok-locatieserver-1): echte adresverificatie, met een lokale antwoordcache en gespreide aanvragen.
- [Kadaster/BAG via PDOK](https://api.pdok.nl/kadaster/bag/ogc/v2?f=html&lang=nl): adresdata met Public Domain Mark 1.0. BAG controleert het bestaan van een adres, niet de aanwezigheid van een kastje.

De OSM-afgeleide openbare catalogusexport is beschikbaar onder [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). De website toont de bron en licentielinks direct bij de resultaten; KML bevat de bronvermelding. Dit verandert niet de softwarelicentie of de status van niet-openbare account-, audit- en beoordelingsgegevens.

Deze acht aanvullende bronnen zijn als **uitgeschakelde verwijzingen** in het bronnenregister opgeslagen. Hun locaties zijn niet gekopieerd; er is geen hergebruiktoestemming vastgesteld:

| Bron | Gevonden bronpagina | Openstaande stap |
| --- | --- | --- |
| Buurtkastjeskaart | <https://buurtkastjeskaart.nl/kaart/> | Toegestane export/licentie vastleggen; geen kaartdatabase oogsten |
| MiniKringLoop | <https://www.minikringloop.nl/> | Hergebruiktoestemming en selectie van gratis kastjes |
| Gemeente Woensdrecht | <https://www.woensdrecht.nl/deelkastjes> | Hergebruiktoestemming vastleggen; betaalde verkooppunten uitsluiten |
| woCom | <https://www.wocom.nl/buurtkastjes/> | [Disclaimer](https://www.wocom.nl/disclaimer/) beperkt gebruik; eerst toestemming |
| Woonborg | <https://www.woonborg.nl/ik-ben-huurder/buurtzaken/voedselkastjes/> | Zoekresultaat gevonden; rechtstreeks ophalen liep vast; toegang en toestemming nog controleren |
| Welzijn Barneveld | <https://www.welzijnbarneveld.nl/dienst/buurtkastjes/> | Toegestane export/licentie vastleggen |
| De Tussenvoorziening | <https://tussenvoorziening.nl/wat-is-er-nodig/hulp-bij-geldzorgen/weggeefkastjes/> | Toegestane export/licentie vastleggen |
| Arnhem Klimaatbestendig | <https://www.arnhemklimaatbestendig.nl/plantenruilkasten/> | Toegestane export/licentie vastleggen |

De sites worden niet als partners gepresenteerd. Er zijn geen berichten, toestemmingsaanvragen of formulieren verstuurd. Facebook, Nextdoor en privégroepen zijn niet uitgelezen: voor deze import waren geen geautoriseerde toegang of exports vastgesteld.

## Adres- en publicatiecontroles

1. OSM-objecttype en object-ID vormen de herleidbare bronsleutel; dubbele bron-ID's worden afgewezen.
2. Beperkte toegang, expliciete sluiting, ontbrekende coördinaten en betaalde toegang leiden niet tot publicatie.
3. Zonder door de bron genoemde straat én huisnummer blijft de locatie in beoordeling. Een nabijgelegen woning wordt nooit als adres aangenomen.
4. Een ontbrekende postcode of plaats kan alleen worden aangevuld bij precies één PDOK-resultaat met dezelfde straat en hetzelfde huisnummer, overeenkomende reeds bekende adresdelen en maximaal 100 meter afstand tot het OSM-punt.
5. De bestaande `ingestResidentCandidate`-dienst voert de exacte PDOK-verificatie uit. Publiceerbare kandidaten zijn tevens gecontroleerd op maximaal 100 meter verschil tussen BAG-adrescentrum en bronpunt. Er waren geen afgewezen coördinatenconflicten in deze run.
6. De kaart gebruikt de BAG-adrescoördinaten. Dat is niet noodzakelijk het kastje of de ingang op de meter nauwkeurig; oorspronkelijke OSM-coördinaten blijven in het bewijs bewaard.
7. Categorieën worden alleen toegevoegd als de bron daarvoor een aanwijzing bevat. Geen veronderstelde voorraad. De kaarttekst spreekt daarom van **adrescontrole**, niet van een bezoek ter plaatse.
8. Bronophaaltijd, eventuele veldcontroledatum van OSM en adrescontroletijd zijn verschillende gegevens. Onbekende veldcontroledatums zijn expliciet als onbekend opgeslagen.

## Bestanden, herstel en herhaalbaarheid

Alle onderstaande paden zijn relatief aan de repository. Databestanden zijn bewust uitgesloten van Git.

- `data/exports/osm-discovery/snapshot.json`: oorspronkelijk antwoord, query, endpoint, ophaaltijd en licentielink.
- `data/exports/osm-discovery/pdok/`: opgeslagen echte adresantwoorden voor controle zonder dubbele API-aanvragen.
- `data/exports/osm-discovery/prepared.json`: beoordeelde kandidaten met redenen, aantallen en SHA-256 van het bronbestand.
- `data/exports/osm-discovery/import-2026-09-04T23-23-22-719Z.json`: werkelijke import in de blijvende database, per object met resultaat en interne verwijzing. Tijd in bestandsnaam is UTC; in Nederland was het 5 september.
- `data/exports/osm-discovery/public-catalog-odbl.json`: overdraagbare **openbare** selectie met licentie en beperkingen; geen accountgegevens of beoordelingslijst.
- `data/backups/pre-osm-2026-09-04T23-23-22-719Z.sqlite`: consistente SQLite-reservekopie van vóór migratie en import. Bevat bestaande beheerinformatie; niet openbaar delen.
- `qa/osm-import-rehearsal.sqlite`: afzonderlijke proefkopie, niet gebruikt door de website.
- `scripts/import-osm-discovery.ts`: eenmalig uitvoerbare importprocedure voor deze opgeslagen snapshot, geen achtergrondcrawler.

De procedure maakt vóór iedere toepassing een consistente SQLite-back-up en weigert een niet-bestaande doeldatabase. Bestaande broninstellingen worden niet stilzwijgend ingeschakeld of veranderd. Bij meerdere eigenaren is expliciete werkruimteselectie nodig. Een tweede run op dezelfde proefkopie bleef op 86 locaties en 1.864 beoordelingen: 86 bestaande bewijzen herkend, 1.864 bestaande beoordelingen herkend, geen duplicaten toegevoegd.

De bronophaaltijd blijft bij herhalen gelijk. Deze procedure is **geen veilige manier om een oude snapshot als actuele controle te blijven gebruiken**. Voor een nieuwe ontdekronde moeten bronantwoord, datum, toestemming en beoordelingen opnieuw worden gecontroleerd.

```powershell
# Alleen voorbereiden: bronbestand en echte adresantwoorden controleren; geen catalogusmutatie.
npx.cmd tsx scripts/import-osm-discovery.ts prepare

# Werkelijke mutatie: eerst doel, bronbestand, voorbereiding en reservekopiebeleid controleren.
npx.cmd tsx scripts/import-osm-discovery.ts apply data/weggeefkastjes.sqlite
```

Herstel een reservekopie nooit over een draaiende database heen. Stop eerst alle processen die de betreffende database gebruiken, behoud de huidige database inclusief eventuele nieuwere wijzigingen, en herstel via de bestaande operatorprocedure. De import bevat audit- en locatie-events voor iedere toegevoegde locatie.

## Uitgevoerde verificatie

- 23 testbestanden / 56 tests geslaagd; typecontrole, lint en websitebouw geslaagd.
- Echte lokale API: lijst 86, kaart 86, koelkastfilter 1; correcte OSM-bronvermelding.
- Database `integrity_check=ok`; geen verwijzende-sleutelfouten.
- Alle 18 bestaande rijen uit de oorspronkelijke tabellen inhoudelijk onveranderd teruggevonden na import. Nieuwe migratie-, bron-, locatie-, bewijs- en auditrijen zijn aanvullingen.
- Tweede proefimport gecontroleerd op dubbele locaties en beoordelingsverzoeken.
- Browser toont na verwijderen van eerdere testintercepties en herladen 86 echte locaties, 12 kaarten op de eerste pagina, 8 resultaatpagina's, licentielinks en expliciete adrescontroledatum.

Niet uitgevoerd: fysieke locatiecontrole, actuele voorraadcontrole, geautoriseerde socialemedia-import, publieke deployment of Google Maps SDK-controle met een echte sleutel.
