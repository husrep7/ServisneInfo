# 0002. Web syndication: feedovi na ulazu i na izlazu

- Status: Prihvaćeno
- Datum: 2026-11-04

## Kontekst

Sve obavijesti dolaze scrapingom HTML stranica komunalnih preduzeća. Scraper se lomi kad preduzeće promijeni dizajn stranice (BH Telecom stranica `/bs/pomoc/smetnje` trenutno vraća 404), a ne zna pouzdano ni datum objave. S druge strane, naši podaci su zarobljeni u našoj aplikaciji: ko ih želi u kalendaru, u čitaču vijesti, na portalu općine ili u svom programu, mora otvoriti ServisneInfo.

Web syndication je standardan način da sajt objavi sadržaj u mašinski čitljivom obliku (RSS, Atom, JSON Feed, iCalendar), a drugi ga pretplate bez dogovora i bez scrapinga.

## Odluka

**Ulaz.** Kad izvor objavljuje feed, čitamo feed umjesto HTML-a. `scrapers/feed.ts` čita RSS 2.0 i Atom. Sarajevogas (WordPress, `/feed/`) prvo ide preko feeda, a HTML stranica je rezerva kad feed ne radi. Dedup ključ ostaje isti, pa prelazak ne pravi duplikate. Za ostale izvore provjerili smo i nemaju feed (ViK, EPBiH, Toplane). BH Telecom ima feed, ali samo za vijesti, ne za smetnje.

**Izlaz.** Objavljujemo svoje feedove (`routes/feeds.ts`):

| URL | Format | Za koga |
|-----|--------|---------|
| `/feeds/prekidi.rss` | RSS 2.0 + GeoRSS tačka | čitači vijesti, portali, Slack/Discord, IFTTT/Zapier |
| `/feeds/prekidi.json` | JSON Feed 1.1 (+ `_servisneinfo` sa ulicama i vremenom) | programeri, widgeti |
| `/feeds/prekidi.ics` | iCalendar | Google/Apple/Outlook kalendar: planirani prekidi kao događaji |

Svi primaju `?type=water,electricity` i `?lat=&lng=&radius=`, pa korisnik može pretplatiti kalendar **samo za svoju ulicu**. Na webu su u Profilu → Pretplate (kalendar se otvara preko `webcal://`).

## Razmotrene opcije

- **Samo scraping** — radi danas, ali je krhko i ne daje ništa nazad zajednici.
- **Dogovor sa preduzećima o API-ju** — najbolje dugoročno, ali zavisi od njih. Feed je prvi korak: ako preduzeće (ili općina) objavi RSS, uključujemo ga bez novog koda za parsiranje.
- **WebSub (push umjesto čitanja svakih 15 min)** — dobar sljedeći korak kad izvori objavljuju feedove; za sada nema izvora koji ga podržava.

## Posljedice

- Novi izvor sa feedom = registracija URL-a i filtera, bez pisanja selektora za HTML.
- Feedovi su javni i keširaju se 5 minuta (`Cache-Control`). Ne sadrže lične podatke ni prijave građana.
- Sažetak u feedu je kratak ("Struja · Gatačka, Kraljice Jelene i još 3"), a cijeli tekst je u opisu, po istom pravilu kao na webu.
- Sljedeći koraci: prijedlog komunalnim preduzećima da objave RSS za servisne informacije; WebSub hub za naše feedove.
