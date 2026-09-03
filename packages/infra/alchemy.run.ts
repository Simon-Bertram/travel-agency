import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { config } from "dotenv";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";

config({ path: "./.env" });
config({ path: "../../apps/web/.env" });
config({ path: "../../apps/server/.env" });

export const db = Cloudflare.D1.Database("database", {
  migrations: "../../packages/db/src/migrations",
});

export const server = Cloudflare.Worker("server", {
  compatibility: {
    flags: ["nodejs_compat"],
  },
  dev: {
    port: 3000,
  },
  env: {
    BETTER_AUTH_SECRET: Config.redacted("BETTER_AUTH_SECRET"),
    BETTER_AUTH_URL: Cloudflare.Worker.URL,
    CORS_ORIGIN: Config.string("CORS_ORIGIN"),
    DB: db,
  },
  main: "../../apps/server/src/index.ts",
});

export type ServerEnv = Cloudflare.InferEnv<typeof server>;

export default Alchemy.Stack(
  "travel-agency",
  {
    providers: Cloudflare.providers(),
    state: Alchemy.localState(),
  },
  Effect.gen(function* () {
    const serverWorker = yield* server;
    const webWorker = yield* Cloudflare.Website.Astro("web", {
      dev: {
        port: 4321,
      },
      env: {
        IMAGES: Cloudflare.Images.Images(),
        PUBLIC_SERVER_URL: serverWorker.url.as<string>(),
        SESSION: Cloudflare.KV.Namespace("session"),
      },
      rootDir: "../../apps/web",
    });

    return {
      server: serverWorker.url,
      web: webWorker.url,
    };
  })
);
