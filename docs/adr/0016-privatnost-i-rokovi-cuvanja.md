# 0016. Brisanje podataka i rokovi čuvanja ličnih podataka

- Status: Prihvaćeno
- Datum: 2026-10-30 (zapisano naknadno 2026-11-05, PR #66, #67)

## Kontekst

Aplikacija čuva lične podatke: push token, sačuvane adrese i zadnju lokaciju uređaja, te ime, kontakt i IP hash prijavioca. Prodavnice aplikacija traže politiku privatnosti i način brisanja podataka, a GDPR i zakon o zaštiti ličnih podataka BiH traže da se podaci ne čuvaju duže nego što trebaju.

## Odluka

- **"Isključi obavijesti i obriši moje podatke"** (`DELETE /devices/me`): u jednoj transakciji briše uređaj sa push tokenom, postavkama, adresama, lokacijom i evidencijom obavijesti, a iz njegovih prijava briše ime i kontakt. Same prijave ostaju, zbog moderacije i blokada.
- **Web**: "Obriši moje podatke sa ovog uređaja" u Profilu briše adrese, anonimni ID prijavioca i temu iz `localStorage`.
- **Rokovi čuvanja** (`jobs/retention.job.ts`, svaki dan u 03:30 po sarajevskom vremenu):

  | Podatak | Rok |
  |---------|-----|
  | Zadnja lokacija uređaja koji se nije javio | 90 dana |
  | Ime i kontakt iz obrađene prijave | 7 dana |
  | IP hash prijavioca | 30 dana |

- **Javna stranica `/privatnost`** ("Privatnost i uslovi") opisuje šta se prikuplja, rokove iz tabele, ko još vidi podatke (Vercel, host backenda, OpenStreetMap i Nominatim, Google Fonts, Expo/Apple/Google za push) i kako se podaci brišu. Operater i kontakt dolaze iz `VITE_PRIVACY_OPERATOR` i `VITE_PRIVACY_CONTACT`.

## Razmotrene opcije

- **Brisanje cijele prijave sa uređajem** — izgubila bi se historija za moderaciju i blokadu zloupotrebe; brišu se samo lični dijelovi.
- **Ručno brisanje na zahtjev emailom** — sporo i lako se zaboravi; korisnik to sada radi sam u aplikaciji.
- **Kraći rok za IP hash** — 30 dana je dovoljno za uočavanje ponovljene zloupotrebe, a duže nije potrebno.

## Posljedice

- Rokovi u `RETENTION` i tabela na `/privatnost` se moraju mijenjati zajedno.
- Tekst politike je praktična prva verzija; prije objave u prodavnicama treba pravni pregled (GDPR i zakon BiH).
- Prodavnice i ekran postavki u mobilnoj aplikaciji trebaju linkovati `/privatnost`.
- Računi iz [0003](0003-korisnicki-racuni.md) uvode nove lične podatke (email, sesije) koji još nemaju rok čuvanja ni brisanje računa; to treba dodati.
