# ServisneInfo

Obavijesti o prekidima komunalnih usluga u Sarajevu (voda, struja, gas, grijanje, internet). Scraperi skupljaju obavijesti komunalnih preduzeća, Claude izvlači adrese, a korisnici u pogođenom području dobijaju push notifikaciju.

| App | Stack | Folder |
|-----|-------|--------|
| Backend | Fastify, PostgreSQL + PostGIS, Redis | `apps/backend` |
| Web | Vite + React (Vercel) | `apps/web` |
| Mobile | Expo / React Native | `apps/mobile` |

- Lokalni setup: [SETUP.md](SETUP.md)
- Testovi: `npm test -w apps/backend`
- Deploy backenda: `docker build -f apps/backend/Dockerfile .` (migracije se pokreću automatski pri startu)
