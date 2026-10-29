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

## 2. Pokrenite bazu i Redis

```bash
docker-compose up -d
```

## 3. Instalirajte zavisnosti i pokrenite migracije

```bash
npm install                      # iz roota — instalira backend, web, mobile i packages/shared
npm run migrate -w apps/backend
```

Migracije se primjenjuju redom (`src/db/migrations/*.sql`) i bilježe u tabeli `schema_migrations`, pa je `npm run migrate` sigurno pokretati više puta.

## 4. Pokrenite backend

```bash
npm run backend
# Server radi na http://localhost:3000
# WebSocket na ws://localhost:3000/ws
```

## 5. Pokrenite mobilnu aplikaciju

```bash
# localhost na telefonu ne radi — koristite LAN IP računara
EXPO_PUBLIC_API_URL=http://192.168.x.x:3000 npm run mobile
# Skenirajte QR kod Expo Go aplikacijom
```

Za push notifikacije potreban je EAS projectId (`npx eas init` ga upisuje u `app.json` → `extra.eas.projectId`).

## 6. Web aplikacija

```bash
cp apps/web/.env.example apps/web/.env   # VITE_API_URL
npm run web
```

Na Vercelu: Root Directory ostaje `apps/web`, a uključena opcija "Include files outside of the Root Directory" (default) omogućava da Vercel instalira zavisnosti iz root `package-lock.json`.

## Testovi i CI

```bash
npm test             # backend: parsiranje datuma/vremenske zone, scraperi, dedup
npm run typecheck    # backend, web, mobile, packages/shared
npm run lint         # web
```

API tipovi (`Incident`, `IncidentType`…) žive u `packages/shared`. Uvoze se sa `import type { Incident } from '@servisneinfo/shared'`, pa promjena polja odmah ruši typecheck u aplikaciji koja je ne prati.

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
| POST | /reports | Prijava problema od korisnika |
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
