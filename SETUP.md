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

Za prijave građana u produkciji postavite i:
- `IP_HASH_SALT` — tajna so za hash IP adrese prijavioca (`openssl rand -hex 32`). Sirova IP adresa se ne čuva.
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
| POST | /devices/register | Registracija push tokena |
| POST | /devices/location | Prijava nove lokacije |
| GET | /ws | WebSocket za live update |
| GET | /health | Health check |
| POST | /reports | Prijava problema od korisnika (uvijek 201, i kad je tiho odbačena) |
| GET | /reports/public | Nepotvrđene prijave iz zadnjih 6 sati, bez ličnih podataka |
| GET | /reports | Lista prijava (admin, `Authorization: Bearer $ADMIN_TOKEN`) |
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
