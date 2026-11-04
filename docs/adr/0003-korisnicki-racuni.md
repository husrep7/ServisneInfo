# 0003. Korisnički računi: email, Google i reset lozinke

- Status: Prihvaćeno
- Datum: 2026-11-04

## Kontekst

Web je do sada bio anoniman: adrese su u `localStorage`, a mobilni uređaj je anonimni red u `device_tokens` (KTD1). Želimo ekran za prijavu prije ulaska, prijavu Google računom i reset lozinke emailom. Računi su i osnova za kasnije sinhronizovanje adresa između weba i mobilne aplikacije.

## Odluka

- **Tabele** `users`, `user_sessions`, `password_resets` (migracija 009).
- **Lozinke**: `scrypt` (Node `crypto`, bez nove zavisnosti) sa nasumičnom soli; format `scrypt$N$r$p$sol$hash`, pa se parametri mogu pojačati bez migracije.
- **Sesija**: nasumičan token od 32 bajta. Klijent ga šalje kao `Authorization: Bearer`, a baza čuva samo SHA-256 hash. Traje 30 dana. Header umjesto kolačića jer je web (Vercel) na drugom domenu od API-ja, a mobilna aplikacija ionako šalje header.
- **Google**: Google Identity Services na webu daje ID token; backend ga provjerava na Googleovom `tokeninfo` endpointu i traži naš `GOOGLE_CLIENT_ID`, potvrđen email i važeći rok. Postojeći račun sa istim potvrđenim emailom se poveže sa Googleom.
- **Reset lozinke**: link sa jednokratnim tokenom važi 60 minuta i šalje se preko Resend API-ja (`RESEND_API_KEY`). Bez ključa se email ispisuje u log (lokalni razvoj). `/auth/password/forgot` uvijek vraća 204, da se ne može provjeriti koji emailovi imaju račun. Nova lozinka odjavljuje sve postojeće sesije.
- **Limiti**: 10 pokušaja prijave u minuti po IP hashu; 5 zahtjeva za reset u 15 minuta po IP-u i po emailu.
- **Gost**: ekran prijave ima "Nastavi bez računa". Javne informacije o prekidima ne zaključavamo iza prijave.

## Razmotrene opcije

- **Auth servis (Firebase Auth, Auth0, Supabase)** — manje koda, ali vanjska zavisnost i trošak, a lični podaci kod treće strane. Može se uvesti kasnije: `users.google_sub` je već odvojen od lozinke.
- **JWT bez tabele sesija** — nema upita u bazu, ali odjavu i "odjavi sve uređaje" nije moguće uraditi bez liste opozvanih tokena.
- **Obavezna prijava** — odbačeno: informacija o nestanku vode mora biti dostupna svima.

## Posljedice

- Za Google prijavu u Google Cloud konzoli treba napraviti OAuth Client ID (Web) i dodati web domen u "Authorized JavaScript origins".
- Za slanje emaila treba Resend račun i verifikovan domen pošiljaoca (`MAIL_FROM`).
- Token u `localStorage` je dostupan JavaScriptu stranice; XSS bi ga mogao ukrasti. Ublaženo time što sav tekst iz scrapera ide kroz escape i nema `dangerouslySetInnerHTML`.
- Sljedeći korak: adrese i postavke uz račun (umjesto samo u browseru) i spajanje sa `device_tokens` mobilne aplikacije.
