# 0012. Prijave građana: automatska potvrda i zaštita od spama

- Status: Prihvaćeno (u v1 planu KTD5, KTD6, KTD7, KTD9, KTD10)
- Datum: 2026-10-30 (zapisano naknadno 2026-11-05, PR #56)

## Kontekst

Mnogi prekidi (kvar, pukla cijev) nikad ne stignu na stranicu preduzeća. Građani ih mogu prijaviti, ali jedna prijava nije dokaz, a web formu je lako zloupotrijebiti: brisanjem kolačića jedan čovjek izgleda kao više uređaja. Sa druge strane, kod mobilnih operatera cijeli kvart dijeli jednu IP adresu.

## Odluka

- **KTD5**: potvrđena prijava postaje red u tabeli `incidents` sa `origin = 'user'`. Koristi isti prikaz, obavijesti i statuse kao službeni prekidi. Zona je bafer od 150 m oko tačaka prijava. Nova prijava u zoni produžava `last_seen_at`, a prekid se sam zatvara 6 h nakon zadnje prijave.
- **KTD6**: automatska potvrda traži **3 prijave istog tipa u krugu od 500 m u zadnja 2 h, sa 3 različita uređaja i 3 različite IP adrese**. Provjera je bipartitno uparivanje (uređaj ↔ IP), a ne brojanje različitih vrijednosti. Admin može potvrditi i ručno ([0013](0013-admin-pristup-tokenom.md)).
- **KTD7**: web dobija anonimni ID prijavioca u `localStorage`. IP adresa se čuva **samo kao HMAC** sa tajnom soli `IP_HASH_SALT`. IP klijenta daje Fastify `trustProxy`, podešen na tačan broj proxyja (`TRUST_PROXY_HOPS`).
- **KTD9**: blokiran prijavilac i prijava preko limita dobijaju isti odgovor `201`, a prijava se čuva kao `suppressed` i nikad nije javna.
- **KTD10**: najviše 3 prijave na sat po prijaviocu; web ima i 3 na sat po IP hashu, mobilna nema limit po IP-u. Nepotvrđena prijava ističe nakon 6 h. Iznad toga je grubi limit od 30 prijava u 10 minuta po IP hashu koji vraća `429` ([0015](0015-produkcijska-pravila.md)).

## Razmotrene opcije

- **Brojanje samo uređaja** — web ID je lako lažirati; odbačeno.
- **Limit po IP-u i za mobilnu** — odbacio bi stvarne prijave baš kad nestane vode u cijelom kvartu.
- **Captcha na web formi** — ostavljeno za kasnije; za sada su dovoljni IP uslov, limiti i tiha blokada.
- **Svaka prijava ide adminu na potvrdu** — tačnije, ali sporo noću i vikendom.

## Posljedice

- Server iza proxyja sa pogrešnim `TRUST_PROXY_HOPS` vidi jednu IP adresu za sve, pa potvrda nikad ne prolazi; produkcija zato upozorava na `0` ([0015](0015-produkcijska-pravila.md)).
- Ime i kontakt prijavioca i IP hash se brišu po rokovima iz [0016](0016-privatnost-i-rokovi-cuvanja.md).
- Prijava ostaje krug od 150 m (`Polygon`), i nakon što su službene zone postale unija krugova po ulici ([0006](0006-zona-po-ulici.md)).
