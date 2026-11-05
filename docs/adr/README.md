# Arhitektonske odluke (ADR)

ADR (Architecture Decision Record) je kratak zapis jedne važne odluke: šta smo odlučili, zašto i šta to povlači. Kad za godinu dana neko pita "zašto ovo radi ovako?", odgovor je ovdje, a ne u nečijem sjećanju.

| # | Odluka | Status |
|---|--------|--------|
| [0001](0001-biljezimo-odluke.md) | Bilježimo arhitektonske odluke kao ADR | Prihvaćeno |
| [0002](0002-web-syndication.md) | Web syndication: feedovi na ulazu i na izlazu | Prihvaćeno |
| [0003](0003-korisnicki-racuni.md) | Korisnički računi: email, Google i reset lozinke | Prihvaćeno |
| [0004](0004-lokacija-i-openstreetmap.md) | Lokacija korisnika i objekti iz OpenStreetMapa | Prihvaćeno |
| [0005](0005-rute-oko-radova.md) | Rute koje zaobilaze radove | Prihvaćeno |
| [0006](0006-zona-po-ulici.md) | Zona prekida je unija krugova oko svake ulice | Prihvaćeno |
| [0007](0007-monorepo.md) | Monorepo sa npm workspaces i zajedničkim tipovima | Prihvaćeno |
| [0008](0008-scraperi-i-izvlacenje-adresa.md) | Obavijesti dolaze scraperima, a adrese izvlači Claude | Prihvaćeno |
| [0009](0009-backend-stack-i-deploy.md) | Backend: Fastify, PostGIS, Redis i Docker sa migracijama pri startu | Prihvaćeno |
| [0010](0010-anonimni-uredjaj.md) | Anonimni uređaj sa `tokenId`-em, adrese i lokacija (KTD1, KTD2, KTD11, KTD12) | Prihvaćeno |
| [0011](0011-obavijesti-po-koracima.md) | Push obavijesti po koracima: najava, podsjetnik, početak (KTD3, KTD4) | Prihvaćeno |
| [0012](0012-prijave-gradjana.md) | Prijave građana: automatska potvrda i zaštita od spama (KTD5–KTD7, KTD9, KTD10) | Prihvaćeno |
| [0013](0013-admin-pristup-tokenom.md) | Admin se prijavljuje jednim `ADMIN_TOKEN`-om (KTD8) | Prihvaćeno |
| [0014](0014-alarm-za-scrapere.md) | Alarm kad scraper prestane raditi ili utihne | Prihvaćeno |
| [0015](0015-produkcijska-pravila.md) | Produkcijska pravila: env, CORS, health check, gašenje i limiti | Prihvaćeno |
| [0016](0016-privatnost-i-rokovi-cuvanja.md) | Brisanje podataka i rokovi čuvanja ličnih podataka | Prihvaćeno |
| [0017](0017-identifikator-aplikacije.md) | Identifikator aplikacije je `ba.servisneinfo.app` (KTD13) | Prihvaćeno |

ADR-ovi 0007–0017 su zapisani naknadno, za odluke donesene prije pravila iz 0001. Oznake KTD1–KTD13 u komentarima koda su iz v1 plana (PR #40); tabela iznad pokazuje koji ADR ih pokriva. Šta je od user storyja gotovo vidi u [`../USER_STORIES.md`](../USER_STORIES.md).

## Kako napisati novi ADR

1. Kopiraj [`template.md`](template.md) u `NNNN-kratak-naziv.md` (sljedeći broj).
2. Popuni kontekst, odluku i posljedice. Kratko: jedna do dvije stranice.
3. Dodaj red u tabelu iznad i pošalji uz PR koji uvodi promjenu.
4. ADR se ne briše. Kad se odluka promijeni, novi ADR je "zamjenjuje", a stari dobija status `Zamijenjeno ADR-om NNNN`.
