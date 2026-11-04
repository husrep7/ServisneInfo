# 0004. Lokacija korisnika i objekti iz OpenStreetMapa

- Status: Prihvaćeno
- Datum: 2026-11-04

## Kontekst

Lokacija je ključna: korisnik treba čim otvori aplikaciju vidjeti da li je prekid u njegovoj ulici, šta je u blizini, i naći najbliži bankomat, pumpu, poštu ili apoteku, tekstom ("pošta kod Ferhadije") ili oko sebe.

Prva verzija je za svaki zahtjev zvala javne servere (Overpass za objekte, Nominatim za adrese). Tokom testiranja Overpass nije odgovarao (timeout na četiri servera), a Nominatim nas je ograničio (HTTP 429). Javni servisi su besplatni, ali nisu za korisnički saobraćaj u realnom vremenu.

## Odluka

1. **GPS odmah**: početna (`/`) traži lokaciju iz browsera pri otvaranju (`watchPosition`, pomak < 40 m se ignoriše). Kad lokacija nije dozvoljena, korisnik bira sačuvanu adresu ili traži ulicu.
2. **Dnevni uvoz iz OpenStreetMapa u našu bazu** (`jobs/places.job.ts`):
   - `places`: bankomati, pumpe, pošte, apoteke i banke u Kantonu (jedan Overpass upit, oko 560 objekata). Banka sa `atm=yes` se pojavljuje i kao bankomat.
   - `gazetteer`: ulice i naselja Kantona (oko 1.800 naziva) sa normalizovanim nazivom bez dijakritika i padežnih završetaka ("Ferhadije" i "Ferhadija" → `ferhadij`).
   Neuspjeli uvoz se ponavlja svaki sat, a postojeći podaci ostaju dok novi uvoz ne uspije.
3. **"U blizini" je PostGIS upit** (`ST_DWithin`) nad našom tabelom: ~80 ms, bez vanjskog poziva. Uz svaki objekat ide upozorenje kad je u zoni aktivnog prekida struje ili interneta ("možda ne radi").
4. **Pametna pretraga** (`/search`): ključne riječi prepoznaju kategoriju (bankomat, pumpa, pošta, apoteka, banka) i mjesto. Kad ključne riječi ne prepoznaju upit, a postoji `ANTHROPIC_API_KEY`, upit tumači Claude Haiku (isti ključ kao za izvlačenje adresa). Mjesto se traži prvo u `gazetteer`, pa tek onda u Nominatimu.
5. **Scraperi** traže ulicu prvo u `gazetteer`, pa u Nominatimu, i pamte rezultat. To smanjuje opterećenje Nominatima, a time i 429 greške za korisnike.

## Razmotrene opcije

- **Google Places / Maps API** — najbolji podaci i "Google AI" pretraga, ali traži karticu, naplaćuje se po zahtjevu i uslovi zabranjuju čuvanje rezultata. Ostaje opcija ako OSM podaci za neku kategoriju nisu dovoljni.
- **Upit prema Overpassu po korisniku** — prva verzija; odbačeno zbog nedostupnosti i limita.
- **Vlastiti Nominatim/Overpass server** — najrobusnije, ali treba server sa ~50 GB za BiH. Za sada nepotrebno uz dnevni uvoz.

## Posljedice

- Podaci o objektima su stari najviše dan. Radno vrijeme dolazi iz OSM-a (`opening_hours`) i često ga nema; "dežurnu apoteku" ne možemo pouzdano znati, pa je ne nudimo.
- Kvalitet zavisi od OSM-a. Nedostajući bankomat se može dodati na openstreetmap.org i pojavi se sljedeći dan.
- OSM licenca (ODbL) traži navođenje izvora: "© OpenStreetMap" je na mapi i na ekranu prijave.
