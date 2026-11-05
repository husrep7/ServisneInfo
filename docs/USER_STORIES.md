# ServisneInfo: user stories i funkcije

Ovaj dokument opisuje šta ServisneInfo treba da radi za korisnike i dokle je stiglo.

- **Stanje na dan:** 30. 10. 2026, `main` na commitu `0d84305`.
- **Izvori:** kod na `main`, otvoreni PR-ovi #53–#60 i v1 plan iz PR-a [#40](https://github.com/husrep7/ServisneInfo/pull/40).
- **Oznake R1–R23 i KTD:** zahtjevi i tehničke odluke iz v1 plana.
- **Održavanje:** status se ažurira ručno, pa ga treba promijeniti kad se PR spoji.

## Legenda

| Oznaka | Značenje |
|---|---|
| ✅ Gotovo | Kod je na `main`. To ne znači da radi na produkciji: deploy se prati u #3 i #4. |
| 🟡 Djelimično | Dio je na `main`, a ostatak je u PR-u ili planu. Razlika piše uz priču. |
| 🔄 U PR-u | Kod postoji u otvorenom PR-u, ali nije na `main`. |
| 📋 Planirano | Postoji tiket, ali koda još nema. |

## Akteri

- **Posjetilac weba:** gleda prekide i šalje prijave, a obavijesti ne dobija.
- **Korisnik aplikacije:** stanovnik koji želi obavijest za svoje adrese ili lokaciju.
- **Admin:** član tima koji moderira prijave i blokira spamere.
- **Tim projekta:** održava izvore podataka i prati da li sistem radi.

## User stories

### Pregled prekida

**US-01: Lista prekida** · ✅ Gotovo · R1

Kao stanovnik, želim na jednom mjestu vidjeti aktivne i planirane prekide, da ne moram otvarati stranicu svakog preduzeća.

- Web prikazuje brojače Aktivno i Planirano. Po defaultu lista sadrži zadnjih 5 aktivnih prekida.
- Klik na brojač prikazuje sve prekide iz te grupe, grupisane po preduzeću.
- Mobilna lista sadrži aktivne i planirane prekide. Uz dozvolu za lokaciju prikazuje udaljenost do prekida.

**US-02: Mapa prekida** · ✅ Gotovo · R1

Kao stanovnik, želim vidjeti prekide na mapi, da odmah vidim da li se tiču mog dijela grada.

- Web prikazuje marker za svaki prekid, a klik na marker otvara popup s linkom na detalje.
- Web marker bez tačne zone ide na centar općine, ako se općina može prepoznati.
- Mobilna prikazuje zone prekida, legendu i dugme za centriranje na moju lokaciju.

**US-03: Detalji prekida** · 🟡 Djelimično · R2, #45

Kao stanovnik, želim vidjeti detalje prekida, da znam kada počinje, kada završava i koje ulice obuhvata.

- ✅ Web: status, vrijeme, pogođene adrese, zona na mapi i link na izvornu obavijest.
- 📋 Mobilna: ekran s detaljima ne postoji. Kartica u listi ima samo link "Izvor".

**US-04: Filter po vrsti usluge** · 🟡 Djelimično · R3

Kao stanovnik, želim filtrirati prikaz po usluzi (voda, struja, gas, grijanje, internet), da vidim samo ono što me zanima.

- ✅ Filter postoji na web mapi i u mobilnoj listi.
- ⚠️ Nema ga na web početnoj ni na mobilnoj mapi, a tiket za to još ne postoji.

**US-05: Automatsko osvježavanje** · 🟡 Djelimično · #11

Kao stanovnik, želim da se lista sama osvježi, da ne gledam zastarjele podatke.

- ✅ Web početna i mobilna aplikacija osvježavaju podatke preko WebSocketa i svakih 60 sekundi.
- ⚠️ Web mapa se učitava samo pri otvaranju stranice.
- 📋 Backend šalje WebSocket događaj samo za nove prekide. Završeni prekid nestaje tek pri sljedećem osvježavanju (#11).

**US-06: Filter "Kod mene"** · 🔄 U PR-u · R4, #59, #47

Kao stanovnik, želim suziti prikaz na svoje sačuvane adrese, da vidim samo prekide koji me se tiču.

- 🔄 Web: filter na početnoj i mapi, uz poruke kad nema adresa ili nema prekida (#59).
- 📋 Mobilna: planirano u #47.

**US-07: Preduzeća i stanje izvora** · ✅ Gotovo

Kao stanovnik, želim vidjeti kontakt preduzeća i kada su podaci zadnji put ažurirani, da znam koliko im mogu vjerovati.

- Profil na webu prikazuje telefon i web stranicu svakog preduzeća.
- Uz svako preduzeće piše vrijeme zadnjeg preuzimanja, broj pronađenih obavijesti i eventualna greška.

**US-08: Tamni mod** · ✅ Gotovo

Kao posjetilac weba, želim birati svijetli ili tamni izgled, da mi je ugodnije čitati.

- Izbor se mijenja u Profilu i ostaje zapamćen u browseru.

### Adrese i lokacija

**US-09: Sačuvane adrese bez računa** · 🔄 U PR-u · R5, #60, #59, #46

Kao korisnik, želim sačuvati više adresa (kuća, posao, roditelji) bez pravljenja računa, da pratim prekide na svim mjestima koja su mi važna.

- Najviše 5 adresa po uređaju.
- 🔄 Web čuva adrese samo u browseru (#59).
- 🔄 Backend čuva adrese mobilnog uređaja (#60).
- 📋 Mobilni ekran za adrese je u #46.

**US-10: Provjera adrese na mapi** · 🔄 U PR-u · R6, #60, #59, #46

Kao korisnik, želim vidjeti pronađenu adresu na mapi i pomjeriti pin, da budem siguran da obavijesti stižu za pravo mjesto.

- Pretraga je ograničena na Kanton Sarajevo.
- Ako adresa nije pronađena, korisnik na webu može pin postaviti ručno.
- 🔄 Web forma je u #59, a backend pretraga u #60. 📋 Mobilni ekran je u #46.

**US-11: Obavijesti po lokaciji uz pristanak** · 🟡 Djelimično · R7, #60, #46

Kao korisnik, želim sam odlučiti da li aplikacija koristi moju lokaciju, da moja privatnost ostane pod mojom kontrolom.

- Opcija je po defaultu isključena. Pri isključivanju se briše zadnja poznata lokacija.
- 🔄 Backend je u #60.
- ⚠️ Mobilna na `main` još traži lokaciju pri pokretanju i šalje je serveru. To se mijenja u #46.

**US-12: Prvo pokretanje aplikacije** · 📋 Planirano · #46

Kao novi korisnik, želim kratak uvod pri prvom otvaranju, da odmah podesim adresu i obavijesti.

- Aplikacija traži dozvolu za push.
- Korisnik dodaje bar jednu adresu i vidi je na mapi.
- Nudi se obavijest po lokaciji i izbor usluga.

### Obavijesti (samo mobilna)

**US-13: Push za prekid u mojoj zoni** · 🟡 Djelimično · R8, #43

Kao korisnik, želim dobiti push kad se prekid tiče moje adrese ili lokacije, da saznam za njega bez traženja.

- ✅ Push ide uređajima čija je zadnja GPS lokacija u zoni prekida.
- ✅ Uređaj koji uđe u zonu aktivnog prekida dobija obavijest kad pošalje novu lokaciju.
- 📋 Push za sačuvane adrese je u #43.

**US-14: Najava planiranog prekida** · 🟡 Djelimično · R9, #44

Kao korisnik, želim najavu čim se planirani prekid objavi, da se stignem pripremiti.

- ✅ Push ide kad scraper prvi put upiše prekid sa zonom.
- 📋 Poruka još ne razlikuje najavu od početka prekida (#44).

**US-15: Podsjetnik prije početka** · 📋 Planirano · R10, #44

Kao korisnik, želim podsjetnik prije planiranog prekida, da ne zaboravim natočiti vodu ili završiti posao.

- Default je 1 sat prije početka. Može se promijeniti ili isključiti.
- Podsjetnik se ne šalje ako je najava stigla unutar tog prozora.
- 🔄 Čuvanje ove postavke na backendu je u #60.

**US-16: Obavijest za prekid koji je već počeo** · 🟡 Djelimično · R11, #44

Kao korisnik, želim jednu obavijest za iznenadan prekid, da znam šta se dešava.

- ✅ Push ide kad se pojavi novi aktivan prekid.
- 📋 Poseban korak "početak" je u #44.

**US-17: Bez dupliranih obavijesti** · 🟡 Djelimično · R12, #43

Kao korisnik, želim dobiti jednu obavijest po koraku, i kad je više mojih adresa u istoj zoni, da mi aplikacija ne smeta.

- ✅ Danas uređaj dobija najviše jedan push po prekidu.
- 📋 Evidencija po koraku (najava, podsjetnik, početak) je u #43.

**US-18: Isključivanje vrsta usluga** · 📋 Planirano · R13, #60, #46, #43

Kao korisnik, želim isključiti obavijesti za usluge koje me ne zanimaju, da dobijam samo korisne obavijesti.

- Prekid isključene usluge i dalje se vidi u listi.
- 🔄 Postavka na backendu je u #60. 📋 Ekran je u #46, a primjena pri slanju u #43.

**US-19: Tap na obavijest otvara prekid** · 📋 Planirano · R2, #45

Kao korisnik, želim da me tap na obavijest odvede na detalje prekida, da odmah vidim o čemu se radi.

- Push već nosi ID prekida, ali aplikacija ga još ne koristi.

### Prijave korisnika

**US-20: Slanje prijave** · 🟡 Djelimično · R14, #56, #59, #48

Kao stanovnik, želim prijaviti kvar koji nije objavljen, da upozorim druge i ubrzam informaciju.

- ✅ Web forma: tip, kratak opis, adresa, a opciono detalji, ime i kontakt.
- 🔄 Pin na mapi i anonimni ID prijavioca su u #56 i #59.
- 📋 Prijava sa mobilne je u #48.

**US-21: Nepotvrđene prijave su odmah vidljive** · 🔄 U PR-u · R15, #56, #59, #47

Kao stanovnik, želim odmah vidjeti tuđe prijave označene kao nepotvrđene, da saznam za kvar prije službene obavijesti.

- Prijava je jasno označena i ne okida push.
- Javni prikaz ne sadrži ime, kontakt ni identifikatore prijavioca.
- 📋 Prikaz na mobilnoj je u #47.

**US-22: Automatska potvrda** · 🔄 U PR-u · R16, KTD6, #56

Kao stanovnik, želim da se prijava sama potvrdi kad je više ljudi prijavi, da pravi kvar stigne do drugih i noću.

- Uslov: 3 prijave istog tipa u krugu od 500 m u 2 sata.
- Prijave moraju doći od 3 različita prijavioca i sa 3 različite IP adrese.

**US-23: Potvrđena prijava postaje prekid** · 🔄 U PR-u · R17, #56, #59

Kao stanovnik, želim potvrđenu prijavu vidjeti kao pravi prekid, uz oznaku da dolazi od korisnika, da znam koliko joj mogu vjerovati.

- Prekid dobija zonu od 150 m i šalje obavijest uređajima u zoni.
- Sam se zatvara 6 sati nakon zadnje prijave koja ga podržava.

**US-24: Limit prijava** · 🔄 U PR-u · R18, #56

Kao tim projekta, želim ograničiti broj prijava, da jedna osoba ne može zatrpati sistem.

- Najviše 3 prijave na sat po prijaviocu. Web ima i limit od 3 na sat po IP hashu.
- Prijava preko limita dobija isti odgovor kao uspješna, ali se ne prikazuje javno.

**US-25: Isticanje nepotvrđenih prijava** · 🔄 U PR-u · R19, #56

Kao stanovnik, želim da stare nepotvrđene prijave nestanu, da prikaz ostane aktuelan.

- Nepotvrđena prijava ističe nakon 6 sati.

### Administracija

**US-26: Prijava admina** · 🟡 Djelimično · KTD8, #58

Kao admin, želim siguran pristup admin dijelu, da prijave i lični podaci ostanu zaštićeni.

- ✅ Na `main` postoje prijava i sidebar, ali lozinka se provjerava samo u browseru, što je privremeno rješenje.
- 🔄 Prijava sa `ADMIN_TOKEN`-om, provjerena na serveru, je u #58.

**US-27: Pregled, potvrda i odbijanje prijava** · 🔄 U PR-u · R20, #57, #58

Kao admin, želim pregledati prijave i svaku potvrditi ili odbiti, da javni prikaz ostane vjerodostojan.

- Potvrđena prijava postaje prekid i šalje obavijest.
- Odbijena prijava nestaje iz javnog prikaza.
- Na `main` su admin stranice prazne, a backend ima samo listu prijava.

**US-28: Blokiranje spamera** · 🔄 U PR-u · R21, #57, #58

Kao admin, želim blokirati prijavioca koji spama, da prestanem dobijati lažne prijave.

- Njegove prijave nestaju iz javnog prikaza, a nove se tiho odbacuju.
- Pošiljalac vidi uobičajenu potvrdu slanja.
- Blokiranje se može poništiti.

**US-29: Zatvaranje korisničkog prekida** · 🔄 U PR-u · #57, #58

Kao admin, želim ručno zatvoriti prekid nastao iz prijava, da pogrešan prekid odmah nestane.

- Službeni prekidi se ne mogu zatvoriti ovim putem.

**US-30: Admin pregled sistema** · 🔄 U PR-u · #58

Kao admin, želim jedan pregled stanja, da odmah vidim šta traži pažnju.

- Dashboard prikazuje prijave na čekanju, aktivne i korisničke prekide, blokirane prijavioce i ispravne izvore.
- Izvori prikazuju zadnja pokretanja scrapera.

### Podaci i rad sistema

**US-31: Automatsko preuzimanje obavijesti** · ✅ Gotovo

Kao tim projekta, želim da se obavijesti preduzeća preuzimaju same, da podaci budu aktuelni bez ručnog rada.

- Izvori: KJKP Vodovod, Elektrodistribucija EPBiH, Sarajevogas, Toplane Sarajevo i BH Telecom.
- Preuzimanje radi svakih 15 minuta, a interval se može promijeniti.
- Otvoreno: provjera BH Telecom scrapera na stvarnoj stranici (#20) i ispravan URL za Elektrodistribuciju (#7).

**US-32: Pretvaranje obavijesti u zonu na mapi** · ✅ Gotovo

Kao stanovnik, želim da obavijest postane zona na mapi, da vidim koje je područje pogođeno.

- Claude iz teksta izvlači ulice, a Nominatim ih pretvara u koordinate u Kantonu Sarajevo.
- Zona je područje oko pronađenih tačaka, proširenje za 150 m.
- Bez `ANTHROPIC_API_KEY` adrese se ne izvlače iz teksta.
- Otvoreno: izbacivanje pogrešno geokodiranih tačaka i limit veličine zone (#22).

**US-33: Automatski status prekida** · ✅ Gotovo

Kao stanovnik, želim tačan status prekida, da znam šta važi upravo sada.

- Status se provjerava svakih 5 minuta.
- Planirani prekid postaje aktivan kad počne, a aktivan se zatvara kad prođe vrijeme završetka.
- Prekid bez vremena završetka zatvara se kad ga izvor više ne objavljuje.

**US-34: Upozorenje kad izvor prestane raditi** · 📋 Planirano · #19

Kao tim projekta, želim upozorenje kad scraper prestane raditi, da korisnici ne ostanu bez obavijesti a da to niko ne primijeti.

- Danas se greške vide samo u Profilu i logovima.

**US-35: Privatnost i brisanje podataka** · 📋 Planirano · #26, #36

Kao korisnik, želim znati koje podatke aplikacija čuva i moći ih obrisati, da imam kontrolu nad svojim podacima.

- Politika privatnosti i uslovi korištenja (#36).
- Brisanje uređaja i rok čuvanja lokacije (#26).

## Funkcije po aplikaciji

### Web

| Funkcija | Status | Veza |
|---|---|---|
| Početna s brojačima i listom prekida | ✅ | US-01 |
| Grupisanje po preduzeću | ✅ | US-01 |
| Mapa s markerima i filterom po usluzi | ✅ | US-02, US-04 |
| Detalji prekida sa zonom na mapi | ✅ | US-03 |
| Osvježavanje početne uživo | ✅ | US-05 |
| Profil: preduzeća, kontakti, stanje izvora | ✅ | US-07 |
| Tamni mod | ✅ | US-08 |
| Forma za prijavu | ✅ | US-20 |
| Stranica 404 | ✅ | |
| Admin prijava i sidebar (privremeno) | 🟡 | US-26 |
| Redizajn i desktop raspored | 🔄 #55 | |
| Moje adrese i "Kod mene" | 🔄 #59 | US-06, US-09, US-10 |
| Nepotvrđene prijave u listi i na mapi | 🔄 #59 | US-21 |
| Pin na mapi u formi za prijavu | 🔄 #59 | US-20 |
| Admin: Dashboard, Prekidi, Prijave, Blokirani, Izvori, Profil | 🔄 #58 | US-27 do US-30 |
| SEO i PWA osnove | 📋 #34 | |
| Arhiva prekida | 📋 #35 | |

### Mobilna aplikacija

| Funkcija | Status | Veza |
|---|---|---|
| Lista prekida s filterom po usluzi | ✅ | US-01, US-04 |
| Mapa sa zonama, legendom i centriranjem | ✅ | US-02 |
| Prikaz udaljenosti do prekida | ✅ | US-01 |
| Osvježavanje uživo i povlačenjem liste | ✅ | US-05 |
| Registracija za push | ✅ | US-13 |
| Slanje lokacije serveru | 🟡 Radi bez opcije za isključivanje | US-11 |
| Detalji prekida i tap na push | 📋 #45 | US-03, US-19 |
| Uvod, adrese i postavke | 📋 #46 | US-09 do US-12, US-15, US-18 |
| "Kod mene" i nepotvrđene prijave | 📋 #47 | US-06, US-21 |
| Ekran za prijavu | 📋 #48 | US-20 |
| Offline prikaz (poslije v1) | 📋 #32 | |

### Backend

| Funkcija | Status | Veza |
|---|---|---|
| Javni API za prekide (lista, detalji, geo sortiranje) | ✅ | US-01 do US-03 |
| WebSocket za nove prekide | ✅ | US-05 |
| Scraperi za 5 izvora | ✅ | US-31 |
| Izvlačenje adresa i pravljenje zona | ✅ | US-32 |
| Automatski statusi prekida | ✅ | US-33 |
| Registracija uređaja i geofencing | ✅ | US-13 |
| Push preko Expa, po zadnjoj lokaciji | ✅ | US-13, US-17 |
| Prijem prijava | ✅ | US-20 |
| Ručno pokretanje scrapera (admin) | ✅ | |
| Stanje scrapera i health check | ✅ | US-07 |
| Auto-potvrda, limiti, isticanje, javne prijave | 🔄 #56 | US-21 do US-25 |
| Admin API za moderaciju | 🔄 #57 | US-27 do US-29 |
| Postavke i adrese uređaja, pretraga adresa | 🔄 #60 | US-09 do US-11, US-18 |
| Uparivanje po adresi i evidencija po koraku | 📋 #43 | US-13, US-17, US-18 |
| Najava, podsjetnik i početak | 📋 #44 | US-14 do US-16 |
| Rate limiting na javnim endpointima | 📋 #13 | |
| Upozorenje za pokvaren scraper | 📋 #19 | US-34 |

## Van opsega za v1

Sljedeće se u v1 namjerno ne gradi:

- Obavijesti na webu (web push i email).
- Korisnički računi i sinhronizacija adresa između uređaja.
- Gradovi izvan Kantona Sarajevo.
- Obavijest kad se prekid završi.
- Komentari i razgovor uz prijave.
- Primanje reklamacija u ime preduzeća.
- Pravi admin računi sa lozinkama.

## Otvoreno prije objave

- **Backend i web:** deploy i env varijable (#3, #4), tačan URL za Elektrodistribuciju (#7).
- **Mobilna:** `eas init` i API URL (#5), Google Maps ključ za Android (#6), nadogradnja Expo SDK-a (#30), EAS build (#31).
- **Pravno:** politika privatnosti i uslovi korištenja (#36).
- **Naziv:** `app.json` koristi ServisneInfo, ali zaglavlje mobilne početne još piše "KOMUNALNI INFO" (#41).
