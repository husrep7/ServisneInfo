# 0014. Alarm kad scraper prestane raditi ili utihne

- Status: Prihvaćeno
- Datum: 2026-10-30 (zapisano naknadno 2026-11-05, PR #64)

## Kontekst

Scraper se lomi kad preduzeće promijeni stranicu ([0008](0008-scraperi-i-izvlacenje-adresa.md)). Gore od greške je tiho pucanje: parser uspješno vrati 0 obavijesti, a to povuče sve planirane prekide izvora ([0011](0011-obavijesti-po-koracima.md)). Bez alarma to niko ne primijeti dok se korisnici ne požale.

## Odluka

- Zdravlje izvora se računa iz `scraper_runs` u zadnjih 7 dana (`services/scraperHealth.ts`):
  - **`failing`**: 3 uzastopne greške.
  - **`empty`**: 4 uzastopna uspješna scrapea bez rezultata (~1 h), a izvor je inače imao obavijesti u bar polovini uspješnih scrapea.
  - inače **`ok`**.
- Alarm se šalje **samo pri promjeni stanja** (kvar ili oporavak), a stanje se čuva u `scraper_alerts` (migracija 008).
- Kanal je Slack-kompatibilan incoming webhook (`ALERT_WEBHOOK_URL`, JSON `{ text }`). Bez njega se alarm samo loguje.
- Admin panel (Izvori) prikazuje zadnje pokretanje svakog scrapera, ali ne i stanje alarma; to je u logu i na webhooku.

## Razmotrene opcije

- **Vanjski monitoring (Sentry, Better Stack)** — dobro za greške procesa, ali "izvor tiho vraća 0" je pravilo o našim podacima, pa ga ionako računamo sami.
- **Email umjesto webhooka** — traži servis za slanje; webhook radi sa Slackom, Discordom i Mattermostom bez nove zavisnosti.
- **Alarm na svaku grešku** — previše buke; stranice preduzeća povremeno ne odgovaraju.

## Posljedice

- Izvor koji rijetko ima obavijesti (npr. Toplane ljeti) ne daje lažni `empty`, jer nema "obično ima podataka".
- Pragovi su procjena i mogu se mijenjati u `HEALTH_RULES` bez migracije.
- Bez `ALERT_WEBHOOK_URL` u produkciji alarm postoji samo u logu; server na to upozorava pri startu.
