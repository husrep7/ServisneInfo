# 0005. Rute koje zaobilaze radove

- Status: Prihvaćeno
- Datum: 2026-11-04

## Kontekst

Radovi na vodovodnoj, elektro i gasnoj mreži često znače i iskopan ili zatvoren dio ulice. Korisnik koji ide do pošte ili bankomata treba znati da li mu je put kroz zonu radova i postoji li drugi put.

## Odluka

`GET /route?from=&to=&mode=car|foot`:

1. OSRM (`routing.openstreetmap.de`, profil za auto ili pješke) vrati do tri alternativne rute.
2. PostGIS za svaku rutu nađe zone aktivnih i današnjih planiranih prekida kroz koje prolazi (`ST_DWithin` 15 m, za širinu ulice).
3. Preporučena je ruta sa najmanje zona, a među jednakima najbrža.

Web crta preporučenu rutu zeleno, ostale isprekidano (crveno ako prolaze kroz radove), i za svaku piše "Bez radova na putu" ili kroz koje zone prolazi. Uz svaki objekat je i dugme za navigaciju u Google Maps.

## Razmotrene opcije

- **OpenRouteService sa `avoid_polygons`** — ruta koja aktivno izbjegava zone, ne samo bira između alternativa. Treba API ključ (besplatan do limita). Najbolji sljedeći korak kad zone budu preciznije.
- **Google Directions** — plaća se, a zone radova ne zna.

## Posljedice

- Ako nijedna alternativa ne zaobilazi radove, kažemo to otvoreno ("preporučena prolazi kroz najmanje zona").
- Zona prekida je zona bez usluge, a ne nužno zatvorena ulica. Upozorenje je informacija, ne zabrana prolaza.
- Javni OSRM server nije za veliki saobraćaj. Limit je 10 ruta u minuti po korisniku; za produkciju vlastiti OSRM ili ORS.
