---
name: alchemy
description: >-
  Alchemy IaC for Cloudflare Workers in packages/infra. Use when editing
  alchemy.run.ts, running alchemy deploy / alchemy dev / alchemy login, or
  changing D1, KV, Images, or Worker bindings. TRIGGER on Alchemy, alchemy.run.ts,
  packages/infra, Cloudflare Workers infra, or infra deploys.
---

# Alchemy

Stack file: [`packages/infra/alchemy.run.ts`](../../../packages/infra/alchemy.run.ts). This app already has web and server Workers — do not add another Worker from the tutorial unless the work actually needs one.

## Docs

Consult only the docs you need for what I ask for — don't march me through every tutorial. A Worker only gets added later if what I want to build needs one (the tutorial covers that in part-2).

Tutorial — foundations, work through whichever parts I haven't touched:

- https://alchemy.run/cloudflare/tutorial/part-1 First Stack (state store + first resource)
- https://alchemy.run/cloudflare/tutorial/part-2 Add a Worker
- https://alchemy.run/cloudflare/tutorial/part-3 Testing
- https://alchemy.run/cloudflare/tutorial/part-4 Local Dev (`alchemy dev`)
- https://alchemy.run/cloudflare/tutorial/part-5 CI/CD (per-PR previews from GitHub Actions)

For everything else (Cloudflare deep-dives, guides, concepts), fetch https://alchemy.run/llms.txt — it's the index of the guide and concept docs. Use it to look up the specific page you need instead of guessing URLs. The per-resource API reference is indexed separately in https://alchemy.run/llms-full.txt — it's large, so only fetch it when you need a specific resource's reference page.

## Important

- Confirm with me before each deploy. Don't batch.
- Do NOT instruct me to export CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN. Alchemy stores credentials in profiles — `alchemy login` (or the first `alchemy deploy`) prompts interactively for OAuth or an API token and saves it to ~/.alchemy/profiles.json.
- Use `bun alchemy deploy` (or the npm/pnpm/yarn equivalent).
- If I'm migrating from Alchemy v1 (async/await), find the v1 migration guide via llms.txt and read it first.

v1 migration guide: https://alchemy.run/migrating-from-v1

## This repo

Package manager is pnpm. From `packages/infra`:

```bash
pnpm exec alchemy login
pnpm exec alchemy deploy
pnpm exec alchemy dev
```

Root shortcut: `pnpm run deploy` (`turbo run deploy -F @travel-agency/infra`).

Credentials belong in the Alchemy profile, not in committed env files. App secrets (`BETTER_AUTH_SECRET`, `CORS_ORIGIN`, `PUBLIC_SERVER_URL`) stay in `apps/server/.env` / `apps/web/.env`.

## State store

This repo uses **default local state** (`.alchemy/` on disk). Do not add `state: Cloudflare.state()` unless shared CI/team deploys need remote state (tutorial part-5).

| Store | Use when |
| --- | --- |
| Local default (omit `state:`) | Solo dev, devcontainer, personal `dev_$USER` stages — **this repo today** |
| `Cloudflare.state()` | Shared remote state across CI runners / team on one account |
| Custom | Only if built-in stores cannot meet a hard requirement — skip |

The devcontainer persists `.alchemy` via the `alchemy-state` named volume and `ALCHEMY_PASSWORD` for secret encryption. `.alchemy` is gitignored.

Stack API is **Alchemy v2** (`Alchemy.Stack` + Effect). Do not treat it as v1 async/await (`await alchemy(...)`).
