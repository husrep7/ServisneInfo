# 0007. Monorepo sa npm workspaces i zajedničkim tipovima

- Status: Prihvaćeno
- Datum: 2026-10-30 (zapisano naknadno 2026-11-05, PR #53)

## Kontekst

Backend, web i mobilna aplikacija su bili u istom repou, ali svaka sa svojim `package-lock.json` i svojom kopijom tipova `Incident`, `IncidentType` i `IncidentStatus`. Kopije su se razilazile, a CI je morao instalirati svaku aplikaciju posebno.

## Odluka

- Repo je npm workspaces monorepo: `apps/backend`, `apps/web`, `apps/mobile` i `packages/shared`. Jedan `npm install` i jedan `package-lock.json` u rootu.
- `packages/shared` (`@servisneinfo/shared`) sadrži **samo tipove** API-ja i uvozi se sa `import type`. Nestaje pri kompajliranju, pa Vite, Metro i Docker ne trebaju ništa posebno.
- Zavisnosti se dodaju u konkretnu aplikaciju: `npm install <paket> -w apps/web`.
- Root skripte (`npm run backend|web|mobile|typecheck|lint|build`, `npm test`) i jedan CI job sa jednim `npm ci`.

## Razmotrene opcije

- **Odvojeni repoi** — jasne granice, ali tipovi API-ja bi išli kroz objavljeni paket i svaka promjena ugovora bi tražila tri PR-a.
- **Turborepo / Nx** — keširanje buildova, ali za tri aplikacije i jedan paket tipova je to višak alata.
- **Zajednički paket sa kodom (ne samo tipovima)** — odbačeno za sada: traži build korak koji Metro i Vite moraju razumjeti.

## Posljedice

- Promjena API tipa je jedan PR, a typecheck odmah pokaže gdje se klijenti razilaze.
- Vercel: Root Directory ostaje `apps/web`, a opcija "Include files outside of the Root Directory" mora biti uključena.
- Web koristi React 19, a mobilna React 18 (Expo SDK 51). npm ih drži odvojeno, ali svaka nadogradnja Expo SDK-a treba provjeru rasporeda u `node_modules`.
- Docker slika i dalje sadrži samo zavisnosti backenda, ali Dockerfile mora kopirati `package.json` svakog workspacea.
