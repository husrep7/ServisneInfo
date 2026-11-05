# 0013. Admin se prijavljuje jednim `ADMIN_TOKEN`-om

- Status: Prihvaćeno (u v1 planu KTD8)
- Datum: 2026-10-30 (zapisano naknadno 2026-11-05, PR #54, #57, #58)

## Kontekst

Prijave građana treba moderirati (potvrditi, odbiti, blokirati prijavioca), a izvore pratiti. Prva verzija admin panela (#54) je provjeravala lozinku u browseru preko PBKDF2 hasha, što je samo zaključan ekran, ne zaštita podataka. Moderira mali tim, dvoje-troje ljudi.

## Odluka

- Admin API (`routes/admin.ts`) štiti postojeći `requireAdmin` (`apps/backend/src/auth.ts`), koji traži `Authorization: Bearer <ADMIN_TOKEN>`.
- Web admin (`/admin`) traži isti token na ekranu prijave. Token se čuva u **`sessionStorage`**, pa nestaje kad se tab zatvori.
- Bez postavljenog `ADMIN_TOKEN`-a admin endpointi su isključeni. U produkciji token mora imati bar 16 znakova ([0015](0015-produkcijska-pravila.md)).

## Razmotrene opcije

- **Pravi admin računi sa lozinkama i ulogama** — potrebno kad moderira više ljudi ili kad treba znati ko je šta uradio. Za v1 je višak. Korisnički računi iz [0003](0003-korisnicki-racuni.md) su dobra osnova za to.
- **Lozinka provjerena u browseru** (prva verzija) — ne štiti API; odbačeno.

## Posljedice

- Svi admini dijele jedan token: nema evidencije ko je moderirao, a odlazak člana tima znači promjenu tokena za sve.
- Promjena tokena = nova env varijabla i restart backenda.
- Kad moderira više od par ljudi, ovaj ADR treba zamijeniti ADR-om za admin račune.
