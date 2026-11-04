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

## Kako napisati novi ADR

1. Kopiraj [`template.md`](template.md) u `NNNN-kratak-naziv.md` (sljedeći broj).
2. Popuni kontekst, odluku i posljedice. Kratko: jedna do dvije stranice.
3. Dodaj red u tabelu iznad i pošalji uz PR koji uvodi promjenu.
4. ADR se ne briše. Kad se odluka promijeni, novi ADR je "zamjenjuje", a stari dobija status `Zamijenjeno ADR-om NNNN`.
