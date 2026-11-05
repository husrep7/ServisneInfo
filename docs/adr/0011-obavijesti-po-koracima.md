# 0011. Push obavijesti po koracima: najava, podsjetnik, početak

- Status: Prihvaćeno (u v1 planu KTD3, KTD4)
- Datum: 2026-10-30 (zapisano naknadno 2026-11-05, PR #61, #63)

## Kontekst

Do sada je uređaj dobijao jedan push po prekidu. Za planirani prekid korisniku treba više: najava kad se objavi, podsjetnik prije početka i obavijest kad prekid počne. Push ne smije stići dva puta (više adresa u istoj zoni, dva procesa u isto vrijeme), a podsjetnik ne smije stići za otkazan ili pomjeren prekid.

## Odluka

- **KTD3**: evidencija poslanih obavijesti je po trojci `(prekid, uređaj, korak)`, korak je `announce`, `reminder` ili `start` (migracija 005). Postojeći zapisi se vode kao najava.
- Svaki korak se **prvo zauzme** (`INSERT … ON CONFLICT DO NOTHING RETURNING`), pa se push šalje samo za zauzete redove. Greška Expo-a oslobađa zauzimanje, pa se korak može ponoviti.
- Primalac je uređaj čija je neka sačuvana adresa ili (uz uključenu lokaciju) zadnja lokacija u zoni, osim ako je tip prekida isključio. Uređaj se pojavi jednom, i kad mu se poklopi više adresa.
- **KTD4**: podsjetnik šalje **backend**, cron provjerom svake minute (`jobs/reminder.job.ts`), a ne lokalno zakazana notifikacija na telefonu. Podsjetnik ide samo ako je najava stigla prije početka prozora za podsjetnik (podrazumijevano 60 min).
- **Povučen prekid**: planiran prekid koji izvor više ne objavljuje nakon zadnjeg *uspješnog* scrapea se zatvara bez podsjetnika. Pomjeren termin stiže kao nova obavijest jer dedup ključ uključuje početak ([0008](0008-scraperi-i-izvlacenje-adresa.md)).
- Push ide preko Expo Push servisa (`expo-server-sdk`, opcioni `EXPO_ACCESS_TOKEN`).

## Razmotrene opcije

- **Lokalna notifikacija na telefonu za podsjetnik** — radi bez servera, ali ostaje na starom terminu kad se prekid pomjeri ili otkaže.
- **Jedan push po prekidu** — jednostavnije, ali korisnik ne dobije upozorenje u pravo vrijeme.
- **Direktno FCM/APNs umjesto Expo-a** — bez posrednika, ali dva odvojena sistema i ključa.

## Posljedice

- Uspješan scrape koji vrati 0 obavijesti povlači sve planirane prekide tog izvora. Ako je parser tiho pukao, to bi zatvorilo sve; zaštita je alarm u [0014](0014-alarm-za-scrapere.md).
- Cron svake minute znači da podsjetnik kasni najviše minut.
- Evidencija `sent_notifications` raste sa brojem uređaja i prekida; brisanje uređaja briše i njegovu evidenciju.
