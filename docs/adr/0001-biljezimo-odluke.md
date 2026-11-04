# 0001. Bilježimo arhitektonske odluke kao ADR

- Status: Prihvaćeno
- Datum: 2026-11-04

## Kontekst

Projekat raste: scraperi, geokodiranje, push, web, mobilna aplikacija, a sad i računi, lokacija i feedovi. Odluke su do sada živjele u komentarima (KTD1…KTD12, R1…R17) i u glavi autora. Novi saradnik (ili mentor) ne može brzo saznati zašto je nešto urađeno baš tako, niti koje su opcije odbačene.

## Odluka

Svaka odluka koja mijenja arhitekturu, izvor podataka, vanjski servis ili ugovor API-ja dobija ADR u `docs/adr`, u formatu iz [`template.md`](template.md) (Michael Nygard: kontekst, odluka, posljedice). ADR ide u isti PR kao i kod.

## Posljedice

- Pregled PR-a počinje od ADR-a: prvo se slažemo oko odluke, pa oko koda.
- Stari ADR-ovi se ne brišu, nego zamjenjuju, pa ostaje historija razmišljanja.
- Male stvari (naziv varijable, refaktor) ne trebaju ADR.
