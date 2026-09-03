# Travel Agency

## Vision

Build a fast, SEO-optimized, highly responsive travel agency platform. It serves public visitors looking for holiday deals and internal staff who manage inventory and customer bookings.

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | Astro |
| Docs | [Starlight](https://starlight.astro.build/) |
| Backend | Hono |
| Hosting | Cloudflare Workers |
| API | oRPC |
| ORM | Drizzle |
| Database | Cloudflare D1 |
| Auth | Better Auth |
| Observability | Evlog |

## Architecture

One Turborepo product, not a separate admin app. Public marketing and deals live on Astro. Product docs live in a separate Starlight app (`apps/docs`). Staff UI lives under `/admin` and is strictly protected by Better Auth middleware.

```mermaid
flowchart LR
  visitor[PublicVisitor] --> web[apps/web Astro]
  staff[Staff] --> admin["/admin Better-Auth"]
  admin --> web
  web --> orpc[oRPC client]
  orpc --> api[packages/api]
  web --> authClient[Better Auth client]
  authClient --> server[apps/server Hono]
  api --> server
  server --> db[packages/db D1]
  server --> evlog[Evlog wide events]
```

## Implementation map

Put new work in these packages:

- **Astro** (`apps/web`): routing and static/hybrid/SSR. Public pages vs `/admin`.
- **Starlight** (`apps/docs`): documentation site. Pages are Markdown/MDX in `src/content/docs/`; sidebar and site config live in `astro.config.mjs`. Do not put docs into `apps/web`. See [Starlight](https://starlight.astro.build/).
- **Hono + Workers** (`apps/server/src/index.ts`): business logic, Better Auth at `/api/auth/*`, oRPC at `/rpc`. Infra is Alchemy in `packages/infra`, not wrangler.toml. Follow [`.agents/skills/alchemy/SKILL.md`](.agents/skills/alchemy/SKILL.md) for login, docs, and deploys.
- **oRPC** (`packages/api`): API schemas and procedures. The Astro client in `apps/web/src/lib/orpc.ts` uses `AppRouterClient` for compile-time safety. Staff APIs use `protectedProcedure`.
- **Drizzle + D1** (`packages/db`): schema and queries against Cloudflare D1. Auth tables exist; inventory and bookings schema is still to come.
- **Better Auth** (`packages/auth/src/index.ts`): `/admin` must be gated by **server** middleware (Astro middleware and/or oRPC `protectedProcedure`). Do not rely on client-only session checks.
- **Evlog**: wide events on the Hono worker in `apps/server/src/index.ts` — one structured JSON payload per request combining user info, DB queries, and errors. Astro request logging in `apps/web/src/middleware.ts` is not the backend wide-event path.

## Current vs intent

Today this is two Cloudflare Workers (`apps/web` + `apps/server`). `/dashboard` is client-gated and `/admin` does not exist yet. Follow the intended model: add `/admin` under `apps/web` and enforce auth on the server.
