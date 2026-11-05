# 0009. Backend: Fastify, PostGIS, Redis i Docker sa migracijama pri startu

- Status: Prihvaćeno
- Datum: 2026-10-29 (zapisano naknadno 2026-11-05, prva verzija i PR #9)

## Kontekst

Glavno pitanje aplikacije je prostorno: "da li je ova tačka u zoni prekida?". Uz to web treba vidjeti novu obavijest bez osvježavanja, a backend mora moći raditi kod bilo kojeg hosta (Railway, Render, Fly.io ili VPS), jer hosting još nije izabran.

## Odluka

- **Fastify** (TypeScript) za HTTP i WebSocket (`@fastify/websocket`).
- **PostgreSQL + PostGIS**: zone su geometrije, a "u zoni" i "u blizini" su `ST_Intersects` / `ST_DWithin` u bazi, uz prostorne indekse.
- **Redis pub/sub**: scraper objavi `incident:new` / `incident:resolved` na kanal `incidents`, a WebSocket ruta to šalje svim klijentima. Tako scraper i HTTP server mogu biti odvojeni procesi.
- **Migracije** su obični SQL fajlovi (`db/migrations/NNN_*.sql`), moraju biti idempotentne i bilježe se u `schema_migrations`. CI ih pokreće **dva puta** na pravom PostGIS-u.
- **Deploy kao Docker slika** (`apps/backend/Dockerfile`): kontejner prvo pokrene migracije, pa server. Slika sadrži samo zavisnosti backenda.

## Razmotrene opcije

- **Supabase / Firebase** — manje infrastrukture, ali prostorni upiti i cron jobovi bi bili razbacani po servisu treće strane.
- **Geometrija u aplikaciji (turf.js) umjesto PostGIS-a** — bez ekstenzije u bazi, ali svaki upit "ko je u zoni" bi učitavao sve uređaje u memoriju.
- **ORM sa generisanim migracijama** — udobnije, ali migracije za PostGIS (tipovi, CHECK, indeksi) se ionako pišu ručno.

## Posljedice

- Host mora imati PostGIS (npr. `postgis/postgis` slika ili managed Postgres sa ekstenzijom) i Redis.
- Migracija koja nije idempotentna pada već u CI-ju, a ne na produkciji.
- Limiti u memoriji (`services/rateLimit.ts`) važe za jednu instancu. Više instanci traži limite u Redisu.
