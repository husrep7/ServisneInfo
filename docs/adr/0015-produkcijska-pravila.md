# 0015. Produkcijska pravila: env, CORS, health check, gašenje i limiti

- Status: Prihvaćeno
- Datum: 2026-10-30 (zapisano naknadno 2026-11-05, PR #65)

## Kontekst

Prije prvog deploya backenda trebalo je osigurati da pogrešna konfiguracija ne prođe tiho (npr. bez `IP_HASH_SALT` se so mijenja pri svakom startu, pa limiti i potvrda prijava ne rade), da samo naš web može zvati API iz browsera, da host zna kad backend ne radi i da restart ne prekine scrape usred upisa.

## Odluka

- **Provjera env-a na startu** (`checkConfig`, Zod): sa `NODE_ENV=production` server odbija start bez `DATABASE_URL`, `REDIS_URL`, `ADMIN_TOKEN` (≥ 16 znakova), `IP_HASH_SALT` (≥ 16 znakova) i `CORS_ORIGINS`. Opcione varijable (`ANTHROPIC_API_KEY`, `EXPO_ACCESS_TOKEN`, `ALERT_WEBHOOK_URL`, `GOOGLE_CLIENT_ID`, `RESEND_API_KEY`) i `TRUST_PROXY_HOPS=0` daju upozorenje. Lokalno rade defaulti.
- **CORS**: `CORS_ORIGINS` je lista dozvoljenih origina; `*` mijenja tačno jedan dio domena (`https://*.vercel.app` za preview deploye). Zahtjev bez `Origin`-a (mobilna, curl) je uvijek dozvoljen.
- **Health check**: `GET /health` provjerava bazu i Redis sa timeoutom od 2 s i vraća `503` kad nešto ne radi; `GET /health/live` samo javlja da proces živi.
- **Gašenje**: na SIGTERM/SIGINT server zaustavi cron, sačeka tekući scrape najviše 7 s, pa zatvori Fastify, Redis i Postgres. Nakon 10 s izlazi silom.
- **Grubi limiti po IP hashu** (u memoriji, `services/rateLimit.ts`): 30 prijava u 10 minuta i 30 **novih** uređaja na sat vraćaju `429`. Ponovna registracija postojećeg uređaja se ne broji.

## Razmotrene opcije

- **Upozorenje umjesto prekida starta** — server bi se podigao, a greška bi se vidjela tek kad korisnici nešto prijave.
- **Limiti u Redisu** — rade i za više instanci, ali za sada imamo jednu ([0009](0009-backend-stack-i-deploy.md)).
- **Captcha / honeypot na web formi** — ostavljeno za kasnije.

## Posljedice

- Prije deploya treba postaviti sve obavezne varijable; spisak je u `SETUP.md`.
- Host treba koristiti `/health` kao health check, a `/health/live` za restart kontejnera.
- Limiti u memoriji se resetuju pri restartu i ne dijele se između instanci.
