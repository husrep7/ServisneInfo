# 0010. Anonimni uređaj sa `tokenId`-em, adrese i lokacija

- Status: Prihvaćeno (u v1 planu KTD1, KTD2, KTD11, KTD12)
- Datum: 2026-10-30 (zapisano naknadno 2026-11-05, PR #59, #60)

## Kontekst

Korisnik treba sačuvati adrese (kuća, posao) i dobiti push kad prekid pogodi neku od njih. U v1 nema korisničkih računa. Do tada je mobilna dobijala identitet tek kad dozvoli push, pa korisnik bez pusha nije mogao ni sačuvati adresu ni poslati prijavu.

## Odluka

- **KTD1**: uređaj se identifikuje `tokenId`-em (UUID) koji je ujedno tajni ključ za njegove postavke i adrese. Mobilna se registruje pri prvom pokretanju, i bez dozvole za push. Expo push token se kasnije veže na isti red. `tokenId` ide **samo u headeru**, nikad u URL-u, jer Fastify loguje URL-ove.
- **KTD2**: adrese mobilnog uređaja su na serveru (bez njih nema pusha). Web nema push, pa njegove adrese ostaju u `localStorage` i služe samo za filter "Kod mene".
- **KTD11**: lokacija je opt-in i na klijentu i na serveru. Mobilna ne traži dozvolu dok korisnik ne uključi opciju. Server gleda lokaciju samo kad je opcija uključena, a pri isključivanju briše zadnju poznatu lokaciju.
- **KTD12**: adresa se geokodira Nominatimom ograničenim na Sarajevo, a korisnik potvrdi ili pomjeri pin prije čuvanja. Za obavijesti se koristi potvrđena tačka.
- Uređaj može sačuvati najviše 5 adresa. Javna pretraga adrese ima svoj limit po IP hashu i svoj red prema Nominatimu.

## Razmotrene opcije

- **Korisnički računi od početka** — sinhronizacija između uređaja, ali prepreka za prvo korištenje. Uvedeni su kasnije kao opcija ([0003](0003-korisnicki-racuni.md)), a gost i dalje može sve.
- **Expo push token kao identitet** — postoji tek uz dozvolu za push i mijenja se, pa korisnik bez pusha ostaje bez adresa.
- **Lokalno zakazane obavijesti na telefonu umjesto adresa na serveru** — server ne bi znao koga obavijestiti o novom prekidu.

## Posljedice

- Ko ima `tokenId`, ima pristup postavkama tog uređaja. Zato nikad ne ide u URL ni u log.
- Adrese i lokacija su lični podaci; rokovi čuvanja i brisanje su u [0016](0016-privatnost-i-rokovi-cuvanja.md).
- Web i mobilna još nemaju zajedničke adrese. To dolazi preko računa ([0003](0003-korisnicki-racuni.md)).
