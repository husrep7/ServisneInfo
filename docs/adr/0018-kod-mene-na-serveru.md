# 0018. "Kod mene" na mobilnoj uparuje server, prijave uparuje aplikacija

- Status: Prihvaćeno
- Datum: 2026-11-05

## Kontekst

Filter "Kod mene" (R4) prikazuje samo prekide čija zona pokriva neku sačuvanu adresu. Na webu su adrese u browseru, pa web uparuje sam (`isNearMe` u `apps/web/src/addresses.ts`). Na mobilnoj su adrese na serveru ([0010](0010-anonimni-uredjaj.md), KTD2), a zona službenog prekida je `MultiPolygon` od desetina krugova ([0006](0006-zona-po-ulici.md)), što je skupo računati na telefonu.

## Odluka

- `GET /incidents?mine=true` vraća samo prekide čija zona sadrži neku adresu uređaja. Uređaj se prepoznaje po `x-device-token` headeru, kao svi `/devices/me` endpointi (KTD1). Uparivanje je isti `ST_Intersects(adresa, zona)` kao za push, pa lista i obavijesti uvijek kažu isto.
- Nepoznat, neispravan ili izostavljen `tokenId` uz `mine=true` daje `404`. Bez `mine=true` header ne mijenja odgovor.
- Nepotvrđene prijave (`GET /reports/public`) su tačke bez zone. Mobilna ih za "Kod mene" filtrira sama: prijava je "kod mene" kad je do 500 m od sačuvane adrese, isti krug kao za automatsku potvrdu (KTD6).

## Razmotrene opcije

- **Uparivanje na telefonu (kao web)** — bez promjene API-ja, ali mobilna bi morala učitati sve zone i adrese i računati presjek za `MultiPolygon`; lako se razilazi sa logikom za push.
- **Novi endpoint `/devices/me/incidents`** — čistiji URL, ali bi dupliran bio filter po statusu, tipu i sortiranje po udaljenosti.
- **`mine` i za prijave na serveru** — moguće kasnije; za sada je prijava najviše 200, pa je filtriranje na telefonu jeftino.

## Posljedice

- Web može preći na isti parametar kad adrese pređu na račun ([0003](0003-korisnicki-racuni.md)).
- Radijus od 500 m za prijave je u `constants/incident.ts` mobilne i mora pratiti KTD6 ako se promijeni.
