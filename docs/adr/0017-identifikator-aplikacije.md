# 0017. Identifikator aplikacije je `ba.servisneinfo.app`

- Status: Prihvaćeno (u v1 planu KTD13)
- Datum: 2026-10-29 (zapisano naknadno 2026-11-05, commit 82c4663, #37)

## Kontekst

Projekat je počeo kao "KomunalniInfo" sa identifikatorom `ba.komunalniinfo.app`, a ime je promijenjeno u ServisneInfo. iOS `bundleIdentifier` i Android `package` se ne mogu promijeniti nakon objave u prodavnici.

## Odluka

Identifikator je `ba.servisneinfo.app` na iOS-u i Androidu (`apps/mobile/app.json`), a paketi u monorepou su `@servisneinfo/*`. Promjena je sigurna samo zato što aplikacija još nije objavljena.

## Razmotrene opcije

- **Zadržati `ba.komunalniinfo.app`** — bez rizika, ali staro ime bi zauvijek ostalo u prodavnicama i u push konfiguraciji.

## Posljedice

- Nakon prve objave identifikator se više ne mijenja; novo ime bi značilo novu aplikaciju u prodavnici.
- Push kredencijali (APNs, FCM) i Expo projekat se vežu na ovaj identifikator.
