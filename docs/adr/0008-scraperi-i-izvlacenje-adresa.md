# 0008. Obavijesti dolaze scraperima, a adrese izvlači Claude

- Status: Prihvaćeno
- Datum: 2026-10-29 (zapisano naknadno 2026-11-05, prva verzija i PR #1, #9)

## Kontekst

Komunalna preduzeća u Sarajevu (ViK, Elektrodistribucija EPBiH, Sarajevogas, Toplane, BH Telecom) objavljuju prekide samo kao tekst na svojim stranicama. Nema API-ja ni dogovora sa njima. Ulice su nabrojane slobodnim tekstom, često u padežu i sa skraćenicama, pa ih nije moguće pouzdano izvući regularnim izrazima.

## Odluka

1. **Scraper po izvoru** (`scrapers/*.ts`, registar u `scrapers/index.ts`) se pokreće svakih 15 minuta (`SCRAPER_INTERVAL_MINUTES`). Parsiranje HTML-a je odvojeno od preuzimanja, pa se testira na snimljenom HTML-u.
2. **Deduplikacija**: svaka obavijest dobija `dedup_key` iz izvora i sadržaja, uključujući početak prekida. Upis je `ON CONFLICT (dedup_key) DO NOTHING`, pa ponovljeni scrape ne pravi duplikate, a pomjeren termin postaje nova obavijest (vidi [0011](0011-obavijesti-po-koracima.md)).
3. **Adrese iz teksta izvlači Claude Haiku** (`services/geocoding.ts`), uz `ANTHROPIC_API_KEY`. Bez ključa scraper i dalje radi, samo obavijest nema zonu.
4. **Geokodiranje preko Nominatima**, ograničeno na Sarajevo (`viewbox`), sa najviše 1 zahtjevom u sekundi za cijelu aplikaciju (Nominatim ToS). Scraperi idu kroz svoj red, da ne usporavaju pretragu korisnika. Kasnije je ispred Nominatima dodan `gazetteer` ([0004](0004-lokacija-i-openstreetmap.md)), a zona je promijenjena u [0006](0006-zona-po-ulici.md).
5. **Svaki scrape se bilježi** u `scraper_runs` (izvor, broj obavijesti, greška). Na tome se kasnije zasnivaju povlačenje obavijesti ([0011](0011-obavijesti-po-koracima.md)) i alarm ([0014](0014-alarm-za-scrapere.md)).

## Razmotrene opcije

- **Regularni izrazi i lista ulica** — jeftino, ali padeži, skraćenice ("ul.", "Hamdije Kreševljakovića br. 1–15") i različit format po preduzeću daju previše promašaja.
- **Ručni unos (admin prepisuje obavijesti)** — tačno, ali ne skalira i kasni.
- **Dogovor sa preduzećima o API-ju ili feedu** — najbolje dugoročno; feed se koristi gdje postoji ([0002](0002-web-syndication.md)).

## Posljedice

- Scraper se lomi kad preduzeće promijeni stranicu. Zato postoji alarm ([0014](0014-alarm-za-scrapere.md)).
- Svaka obavijest košta jedan poziv Claude API-ja. Haiku je dovoljno jeftin za par stotina obavijesti dnevno.
- Kvalitet zone zavisi od Claudea i Nominatima. Ulica koju Nominatim ne nađe ostaje bez tačke.
