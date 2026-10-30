# ServisneInfo

Obavijesti o prekidima komunalnih usluga u Sarajevu (voda, struja, gas, grijanje, internet). Scraperi skupljaju obavijesti komunalnih preduzeća, Claude izvlači adrese, a korisnici u pogođenom području dobijaju push notifikaciju.

| App | Stack | Folder |
|-----|-------|--------|
| Backend | Fastify, PostgreSQL + PostGIS, Redis | `apps/backend` |
| Web | Vite + React (Vercel) | `apps/web` |
| Mobile | Expo / React Native | `apps/mobile` |
| Zajednički tipovi | TypeScript (samo tipovi API-ja) | `packages/shared` |

Repo je npm workspaces monorepo: jedan `npm install` u rootu instalira sve, a jedan `package-lock.json` važi za sve aplikacije.

```bash
npm install          # sve aplikacije
npm run backend      # Fastify na :3000
npm run web          # Vite dev server
npm run mobile       # Expo
npm run typecheck    # svi workspace-ovi
npm test             # testovi
```

Zavisnosti se dodaju u konkretnu aplikaciju: `npm install <paket> -w apps/web`.

- Lokalni setup: [SETUP.md](SETUP.md)
- Testovi: `npm test` (ili `npm test -w apps/backend`)
- Deploy backenda: `docker build -f apps/backend/Dockerfile .` (migracije se pokreću automatski pri startu)
