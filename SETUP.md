# ServisneInfo — Setup

## Preduslovi
- Docker Desktop
- Node.js 20+
- Expo CLI: `npm install -g expo-cli`

## 1. Environment varijable

```bash
cp .env.example apps/backend/.env
# Popunite ANTHROPIC_API_KEY, EXPO_ACCESS_TOKEN i ADMIN_TOKEN
```

Postgres iz docker-compose radi na portu **5434** (`.env.example` je već podešen).

U produkciji postavite `NODE_ENV=production`. Server tada odbija start ako nedostaje `DATABASE_URL`, `REDIS_URL`, `ADMIN_TOKEN`, `IP_HASH_SALT` ili `CORS_ORIGINS`, i ispiše šta tačno nedostaje.

- `CORS_ORIGINS` — web domeni koji smiju zvati API, npr. `https://servisneinfo.ba,https://*.vercel.app`. Mobilna aplikacija ne šalje `Origin`, pa na nju ne utiče.
- Health check za hosting: `GET /health` (baza i Redis, 503 kad nešto ne radi) i `GET /health/live` (samo proces).

Za prijave građana u produkciji postavite i:
- `IP_HASH_SALT` — tajna so za hash IP adrese prijavioca (`openssl rand -hex 32`). Sirova IP adresa se ne čuva.
- `ALERT_WEBHOOK_URL` — Slack (ili kompatibilan) incoming webhook za alarm kad neki scraper prestane raditi ili tiho vraća 0 obavijesti. Bez njega se alarm samo loguje.
- `TRUST_PROXY_HOPS` — tačan broj proxyja ispred servera (npr. `1` iza jednog load balancera). Sa `0` server vidi adresu proxyja za sve korisnike; s prevelikim brojem klijent može lažirati IP kroz `X-Forwarded-For`.

## 2. Pokrenite bazu i Redis

```bash
docker-compose up -d
```

## 3. Pokrenite migracije

```bash
cd apps/backend
npm install
npm run migrate
```

Migracije se primjenjuju redom (`src/db/migrations/*.sql`) i bilježe u tabeli `schema_migrations`, pa je `npm run migrate` sigurno pokretati više puta.

## 4. Pokrenite backend

```bash
npm run dev
# Server radi na http://localhost:3000
# WebSocket na ws://localhost:3000/ws
```

## 5. Pokrenite mobilnu aplikaciju

```bash
cd apps/mobile
npm install
# localhost na telefonu ne radi — koristite LAN IP računara
EXPO_PUBLIC_API_URL=http://192.168.x.x:3000 npx expo start
# Skenirajte QR kod Expo Go aplikacijom
```

Za push notifikacije potreban je EAS projectId (`npx eas init` ga upisuje u `app.json` → `extra.eas.projectId`).

## 6. Web aplikacija

```bash
cd apps/web
npm install
cp .env.example .env   # VITE_API_URL
npm run dev
```

## Testovi i CI

```bash
npm test -w apps/backend        # parsiranje datuma/vremenske zone, scraperi, dedup
npm run typecheck -w apps/backend
```

GitHub Actions (`.github/workflows/ci.yml`) na svakom PR-u pokreće typecheck (backend, mobile), testove, migracije dva puta na pravom PostGIS-u, kao i lint i build za web.

## Deploy backenda (Docker)

```bash
docker build -f apps/backend/Dockerfile -t servisneinfo-backend .
docker run -p 3000:3000 --env-file apps/backend/.env servisneinfo-backend
```

Kontejner pri startu prvo pokrene migracije (`node dist/db/migrate.js`), pa server. Radi na svakom hostingu koji podržava Dockerfile (Railway, Render, Fly.io, VPS). Potrebni su Postgres sa PostGIS-om i Redis.

## API endpointi

| Method | Path | Opis |
|--------|------|------|
| GET | /incidents | Lista incidenata (opciono: ?lat=&lng=&type=) |
| GET | /incidents/:id | Detalji incidenta |
| GET | /ws | WebSocket za live update |
| POST | /devices/register | Registracija uređaja, push token opcion; header `X-Device-Token` veže token na postojeći uređaj |
| POST | /devices/location | Lokacija uređaja (koristi se samo kad je uključena u postavkama) |
| GET / PATCH | /devices/me/settings | Postavke uređaja: lokacija, podsjetnik, isključeni tipovi (header `X-Device-Token`) |
| GET / POST / DELETE | /devices/me/addresses | Adrese uređaja, najviše 5 (header `X-Device-Token`) |
| DELETE | /devices/me | Brisanje uređaja i njegovih podataka (adrese, lokacija, ime i kontakt iz prijava) |
| GET | /geocode?q= | Pretraga adrese u Kantonu Sarajevo (limit 10/min po IP-u) |
| GET | /health, /health/ready | Health check: baza i Redis (503 kad nešto ne radi) |
| GET | /health/live | Proces je živ |
| POST | /reports | Prijava problema od korisnika (uvijek 201, i kad je tiho odbačena) |
| GET | /reports/public | Nepotvrđene prijave iz zadnjih 6 sati, bez ličnih podataka |
| GET | /admin/reports?status= | Lista prijava sa ličnim podacima (admin, `Authorization: Bearer $ADMIN_TOKEN`) |
| POST | /admin/reports/:id/confirm | Potvrda prijave → korisnički prekid + push (admin) |
| POST | /admin/reports/:id/reject | Odbijanje prijave (admin) |
| POST | /admin/reports/:id/block | Blokada prijavioca te prijave (admin) |
| GET / DELETE | /admin/blocked, /admin/blocked/:key | Blokirani prijavioci i deblokada (admin) |
| POST | /admin/incidents/:id/close | Ručno zatvaranje korisničkog prekida (admin) |
| POST | /scrape-now | Ručno pokretanje scrapera (admin) |

## Arhitektura

```
Scrapers (KJKP Vodovod, Elektrodistribucija)
    ↓ svakih 15 min
Claude API (parsiranje adresa iz slobodnog teksta)
    ↓
Nominatim (geocoding adresa → koordinate)
    ↓
PostGIS (polygon = convex hull + 150m buffer)
    ↓
Geofencing (ST_Within query za sve device tokene)
    ↓
Expo Push Notifications → korisnikov telefon
```
