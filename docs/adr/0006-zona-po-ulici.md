# 0006. Zona prekida je unija krugova oko svake ulice

- Status: Prihvaćeno (zamjenjuje "convex hull + 150 m" iz prve verzije)
- Datum: 2026-11-04

## Kontekst

Zona službene obavijesti je pravljena kao konveksni omotač svih geokodiranih ulica plus 150 m. ViK u jednoj obavijesti nabraja ulice sa raznih krajeva grada (npr. 24 ulice od Kovača do Dobrinje). Omotač oko njih je pokrivao pola Sarajeva, pa je korisnik na Baščaršiji dobijao "Bez vode na vašoj lokaciji", iako su radovi bili 400 m dalje. Uz to, 741 od 748 obavijesti uopšte nije imala zonu: model `claude-haiku-5-5` vraća blok razmišljanja prije teksta, a kod je čitao samo prvi blok, pa je izvlačenje adresa uvijek padalo na rezervu (cijeli tekst kao jedna "adresa").

## Odluka

- Zona = `ST_Union` krugova od 150 m oko svake ulice (MultiPolygon). Kolona `affected_area` prima i `Polygon` (prijave građana, stari zapisi) i `MultiPolygon`, uz CHECK na ta dva tipa (migracija 012).
- Izvlačenje adresa čita prvi `text` blok odgovora, sa `effort: "low"` i dovoljno `max_tokens` za duge liste ulica EPBiH.
- `jobs/backfill.job.ts` naknadno pravi zone za aktuelne obavijesti bez zone (3 obavijesti svakih 5 minuta, da Nominatim red ostane slobodan za korisnike). Migracija 012 briše stare omotače aktuelnih službenih obavijesti, pa ih backfill pravi ponovo.
- Web i mobilna aplikacija crtaju svaki dio zone posebno, a provjera "da li je tačka u zoni" radi za oba tipa.

## Posljedice

- Upozorenja "u vašoj ulici" su tačna na nivou ulice, a ne kvarta.
- Duga ulica je predstavljena jednom tačkom (sredinom), pa kraj duge ulice može ostati van zone. Sljedeći korak: krug oko segmenta ulice iz `gazetteer` umjesto oko jedne tačke.
- Nakon deploya, aktuelne obavijesti su par desetina minuta bez zone dok backfill ne završi. Push za njih ide tek kad dobiju zonu, a `sent_notifications` sprečava duplikate.
