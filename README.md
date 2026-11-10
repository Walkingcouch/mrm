# McArthur River Mine app — replacement build

iOS and Android apps, a separate mobile-friendly admin website, and a shared Supabase backend,
built to the owner's brief v1.1 (10 Nov 2026). Replaces the white-label builder so administrator
access can be delegated with checkbox permissions.

| Folder | What |
|---|---|
| `mobile/` | Expo (React Native) app for iOS and Android — information app, no login |
| `admin/` | Next.js admin website — content, PDFs, messages, administrators, roles |
| `supabase/` | Database migrations, permission rules, push dispatch function, tests |
| `docs/` | [Architecture](docs/ARCHITECTURE.md) · [Setup](docs/SETUP.md) · [Release](docs/RELEASE.md) · [Status & acceptance](docs/STATUS.md) |

Quick checks:

```bash
PGUSER=postgres ./scripts/test-db.sh                         # database permission & messaging tests
node --test supabase/functions/_shared/dispatch-core.test.ts  # push dispatch tests
(cd mobile && npm install && npm test && npx tsc --noEmit)
(cd admin && npm install && npx tsc --noEmit && npx eslint src)
```

Pending owner decisions and inputs are listed in [docs/STATUS.md](docs/STATUS.md).
