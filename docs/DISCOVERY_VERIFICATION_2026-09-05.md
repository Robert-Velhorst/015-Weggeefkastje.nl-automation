# Verificatieronde 5 september 2026

> Vervolg, 5 september 23:10 lokale tijd: de beheeruitbreiding is inmiddels beschikbaar. De 206 notities uit deze eerste ronde en 13 aanvullende notities zijn aan de oorspronkelijke meldingen gekoppeld. Zie [de beheerwerkwijze](VERIFICATION_WORKFLOW.md). Onderstaande beschrijving van losse onderzoeksbestanden betreft de eerdere ronde; de historie daarvan blijft bewaard.

## Resultaat en begrenzing

De lokale catalogus bevat na deze ronde **88 gepubliceerde locaties**, tegenover 86 voor deze ronde. Twee bestaande kandidaatverzoeken zijn opgelost. Er blijven **1.862 verzoeken** open. Dit is een lokale gegevenswijziging, geen GitHub-publicatie of internetdeployment.

Alle **206 geselecteerde kandidaten** hebben een technische bron-/adrescontextcontrole gekregen: 197 weggeefkastjes en voedseldeelpunten, plus negen minibiebs met adresproblemen. Dat betekent nadrukkelijk niet dat 206 fysieke kastjes onafhankelijk zijn bevestigd. Voor 186 kandidaten is alleen deze eerste screening afgerond; voor twintig zijn afzonderlijke onderzoeksbevindingen vastgelegd. Twaalf van die twintig hebben een aanvullende websiteverwijzing. Er zijn geen locaties bezocht, eigenaren benaderd, privé-groepen verwerkt of toestemmingen aangevraagd.

## Twee veilige adrescorrecties

| OSM-object | Correctie | Bewijs en beperking |
| --- | --- | --- |
| [12615194476](https://www.openstreetmap.org/node/12615194476) | Professor Leonard Fuchslaan 27 wordt **Prof. Leonard Fuchslaan 27, 3571HD Utrecht** | Exact BAG-resultaat; postcode en huisnummer ongewijzigd; circa 8 meter tussen BAG-adrespunt en oorspronkelijk OSM-punt. |
| [13128873926](https://www.openstreetmap.org/node/13128873926) | Woonplaats Utrecht wordt **De Meern**, bij **'t Zand 34, 3454PB** | Exact BAG-resultaat; straat, postcode en huisnummer ongewijzigd; circa 28 meter tussen beide punten. |

De bestaande toegestane OSM-bron en de reguliere adresverificatie/publicatieroute zijn gebruikt. Alleen de adresnotatie is opgelost; er is geen nieuwe fysieke aanwezigheid of voorraad vastgesteld. Oorspronkelijke bronvermeldingen en afgehandelde verzoeken blijven bewaard. Het kaartpunt van een BAG-adres is niet noodzakelijk de ingang of positie van het kastje.

## Zeven adresproblemen blijven open

| OSM-object | Reden om niet automatisch te publiceren |
| --- | --- |
| 8231565488 | Jacob van Lennepkade 109 mist een mogelijke toevoeging; niet automatisch 109D gekozen. |
| 8730907841 | Grave van Solmsstraat 33,35 noemt twee huisnummers. |
| 11200811567 | Leeshuis: eigenaar noemt Tolhuisweg 4, maar geen exact BAG-resultaat in Amsterdam. Niet verplaatst naar nummer 5. |
| 12420924299 | Laag-Nieuwkoopsebuurtweg versus Laag-Nieuwkoop: straatgelijkheid niet bewezen. |
| 12421290446 | Cremerstraat 376 niet exact teruggevonden. |
| 12421290447 | Cremerstraat 245,247 noemt twee huisnummers. |
| 12971317219 | Zandweg 42 heeft meerdere resultaten, geen nabij het OSM-punt. Buurtweg 42 is geen bewezen alternatief. |

Het [Leeshuis bij Tolhuistuin](https://tolhuistuin.nl/huisgenoten/leeshuis) bevestigt gratis boeken en het genoemde adres. Dit is een concreet verschil tussen een door een eigenaar opgegeven bezoekersadres en een automatisch controleerbaar BAG-adres. De bestaande BAG-publicatievoorwaarde is niet stilzwijgend versoepeld.

## Aanvullende bronnen voor weggeefkastjes

- Negen vermoedelijke overeenkomsten in Lemelerveld zijn vergeleken met [Minder Geldzorgen](https://www.mindergeldzorgen.nl/buurtkastjes-dalfsen). Voor vier sluiten expliciete adressen aan op de zoekcontext. Andere gevallen noemen een terrein, meerdere nummers of een ander nummer dan het dichtstbijzijnde huis. Individuele conclusies staan in het onderzoeksregister. De [disclaimer](https://www.mindergeldzorgen.nl/disclaimer) staat overname van teksten en beelden niet toe; hergebruik voor een import is niet vastgesteld. Geen van deze negen is gepubliceerd.
- [Wildegaard Ede](https://wildegaardede.nl/community.html) noemt een deelkast voor zaden op het kazerneterrein. Het correspondentieadres van de stichting is niet als kastadres gebruikt.
- [WeggeefWinkel Edam](https://www.weggeefwinkeledam.nl/) onderscheidt weggeefevenementen en een inleveradres. Dat bewijst niet dat men op het inleveradres permanent spullen mag meenemen. De kandidaat blijft open.

De overige 186 geselecteerde weggeefkastjes/voedselpunten missen nog zelfstandig gecontroleerde, exacte adreskoppelingen. Hun nabijgelegen BAG-adressen dienen uitsluitend als zoekcontext. Websites die OSM spiegelen tellen niet als onafhankelijke bevestiging. Deze ronde is dus een eerste selectie en gedeeltelijke oplossing, niet de afronding van alle open vondsten.

## Bewijs, herstelbaarheid en controle

Lokale onderzoeksbestanden staan in `data/exports/osm-verification-2026-09-05/`:

- `investigation.json`: 206 unieke controles, nul verzoekfouten; de betekenis van omgekeerd gezochte adressen is expliciet beperkt tot zoekcontext.
- `pdok/`: antwoorden met opvraag-URL en tijdstip.
- `review-ledger.json`: per kandidaat uitkomst, toelichting en eventuele aanvullende bronlink. Dit is een onderzoeksbestand; deze notities zijn niet toegevoegd aan de beheerinterface.
- `verified-addresses/`: exacte BAG-verificatieantwoorden voor de twee correcties.
- `applied-2026-09-05T05-25-47-310Z.json`: wijzigingsrapport voor de echte lokale database, inclusief oude en nieuwe adressen, gekoppelde verzoeken en locatie-IDs.
- `public-catalog-odbl.json`: nieuwe export van alle 88 publieke locaties, met bestaande ODbL-vermelding. De eerdere export met 86 locaties blijft als historische snapshot behouden.

Vooraf is een consistente SQLite-back-up gemaakt: `data/backups/pre-address-review-2026-09-05T05-25-47-310Z.sqlite`. Deze bevat ook interne gegevens en is niet geschikt voor openbare verspreiding. Herstel een live database niet door losse bestanden te overschrijven terwijl de server draait.

De correcties zijn eerst op een databasekopie uitgevoerd: 86 naar 88 locaties en 1.864 naar 1.862 open verzoeken. Een tweede uitvoering op dezelfde kopie gaf twee duplicaten, nul nieuwe locaties en nul extra verzoeken. Vervolgens is de echte lokale database bijgewerkt. Alle 86 oorspronkelijke locatierecords zijn volledig ongewijzigd gebleven; SQLite-integriteit was `ok` en er waren geen foreign-key-fouten. De publieke API op poort 3195 gaf daarna 88 resultaten en bevatte beide gecorrigeerde adressen.

De begrensde uitvoeringsprocedure staat in `scripts/apply-osm-address-review.ts`; deze vereist een expliciet bestaand databasepad, controleert oorspronkelijke adreswaarden en bronhash, gebruikt echte BAG-antwoorden, maakt een back-up en sluit verzoeken pas na publicatie of een bestaande identieke vermelding. Er is geen algemene regel ingevoerd die buurthuizen of dichtstbijzijnde adressen aan kaartpunten toewijst.

## Vervolg

1. Leg toegestane hergebruikvoorwaarden vast voor aanvullende lokale bronnen; verstuur daarvoor niet zonder opdracht contactverzoeken.
2. Controleer per bronvermelding de koppeling met het oorspronkelijke OSM-object, het exacte bezoekersadres, toegankelijkheid en actualiteit.
3. Vraag voor echte bezoekersadressen zonder BAG-match een expliciete productbeslissing over alternatieve adresverificatie; niet automatisch naar een ander huisnummer verplaatsen.
4. Onderzoek de 186 nog niet zelfstandig bevestigde kandidaten verder, bij voorkeur per lokale bron of geografisch cluster. Houd bewijs van aanwezigheid en adresvalidatie apart.
