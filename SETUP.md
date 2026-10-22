# Komunalni Info — Setup

## Preduslovi
- Docker Desktop
- Node.js 20+
- Expo CLI: `npm install -g expo-cli`

## 1. Environment varijable

```bash
cp .env.example apps/backend/.env
# Popunite ANTHROPIC_API_KEY i EXPO_ACCESS_TOKEN
```

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
npx expo start
# Skenirajte QR kod Expo Go aplikacijom
```

## API endpointi

| Method | Path | Opis |
|--------|------|------|
| GET | /incidents | Lista incidenata (opciono: ?lat=&lng=&type=) |
| GET | /incidents/:id | Detalji incidenta |
| POST | /devices/register | Registracija push tokena |
| POST | /devices/location | Prijava nove lokacije |
| GET | /ws | WebSocket za live update |
| GET | /health | Health check |

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
