import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { config } from "dotenv";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";

config({ path: "./.env" });
config({ path: "../../apps/web/.env" });
config({ path: "../../apps/server/.env" });

const isAlchemyDeploy = process.argv.includes("deploy");
const isAlchemyDev = !isAlchemyDeploy;
const evlogDev = isAlchemyDev ? "1" : "0";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);
const TURNSTILE_DUMMY_SITE_KEY = "1x00000000000000000000AA";
const TURNSTILE_DUMMY_SECRET_KEY = "1x0000000000000000000000000000000AA";
const SUBSCRIBE_RATE_LIMIT_NAMESPACE = 7101;
const SUBSCRIBE_RATE_LIMIT_MAX = 5;
const SUBSCRIBE_RATE_LIMIT_PERIOD = 60;

function turnstileDomains(): string[] {
  const hosts = new Set<string>(["travel-kairos.simonbertram.workers.dev"]);
  const extra = process.env.TURNSTILE_DOMAINS;
  if (extra) {
    for (const part of extra.split(",")) {
      const host = part.trim();
      if (host.length > 0) {
        hosts.add(host);
      }
    }
  }
  const corsOrigin = process.env.CORS_ORIGIN;
  if (corsOrigin) {
    try {
      const { hostname } = new URL(corsOrigin);
      if (!LOCAL_HOSTS.has(hostname)) {
        hosts.add(hostname);
      }
    } catch {
      // Invalid CORS_ORIGIN is ignored for Turnstile hostnames.
    }
  }
  return [...hosts];
}

export const db = Cloudflare.D1.Database("database", {
  migrations: "../../packages/db/src/migrations",
});

const subscribeRateLimit = Cloudflare.RateLimit("SUBSCRIBE_RATE_LIMIT", {
  namespaceId: SUBSCRIBE_RATE_LIMIT_NAMESPACE,
  simple: {
    limit: SUBSCRIBE_RATE_LIMIT_MAX,
    period: SUBSCRIBE_RATE_LIMIT_PERIOD,
  },
});

function createServer(turnstileSecret: unknown) {
  return Cloudflare.Worker("server", {
    compatibility: {
      flags: ["nodejs_compat"],
    },
    dev: {
      port: 3000,
    },
    env: {
      AXIOM_API_KEY: Config.string("AXIOM_API_KEY").pipe(
        Config.withDefault("")
      ),
      AXIOM_DATASET: Config.string("AXIOM_DATASET").pipe(
        Config.withDefault("")
      ),
      BETTER_AUTH_SECRET: Config.redacted("BETTER_AUTH_SECRET"),
      BETTER_AUTH_URL: Cloudflare.Worker.URL,
      CORS_ORIGIN: isAlchemyDev
        ? Config.succeed("http://localhost:4321")
        : Config.string("CORS_ORIGIN"),
      DB: db,
      EVLOG_DEV: Config.succeed(evlogDev),
      SUBSCRIBE_RATE_LIMIT: subscribeRateLimit,
      TURNSTILE_SECRET_KEY: turnstileSecret as ReturnType<
        typeof Config.succeed<string>
      >,
    },
    main: "../../apps/server/src/index.ts",
    name: "travel-kairos-server",
  });
}

function createWeb(serverUrl: unknown, turnstileSiteKey: unknown) {
  return Cloudflare.Website.Astro("web", {
    dev: {
      port: 4321,
    },
    env: {
      AXIOM_API_KEY: Config.string("AXIOM_API_KEY").pipe(
        Config.withDefault("")
      ),
      AXIOM_DATASET: Config.string("AXIOM_DATASET").pipe(
        Config.withDefault("")
      ),
      EVLOG_DEV: evlogDev,
      IMAGES: Cloudflare.Images.Images(),
      PUBLIC_SERVER_URL: serverUrl as ReturnType<typeof Config.succeed<string>>,
      PUBLIC_TURNSTILE_SITE_KEY: turnstileSiteKey as ReturnType<
        typeof Config.succeed<string>
      >,
      SESSION: Cloudflare.KV.Namespace("session"),
    },
    name: "travel-kairos",
    rootDir: "../../apps/web",
  });
}

export type ServerEnv = Cloudflare.InferEnv<ReturnType<typeof createServer>>;

export default Alchemy.Stack(
  "travel-kairos",
  {
    providers: Cloudflare.providers(),
    state: Alchemy.localState(),
  },
  Effect.gen(function* () {
    if (isAlchemyDev) {
      const serverWorker = yield* createServer(
        Config.succeed(TURNSTILE_DUMMY_SECRET_KEY)
      );
      const webWorker = yield* createWeb(
        serverWorker.url.as<string>(),
        Config.succeed(TURNSTILE_DUMMY_SITE_KEY)
      );
      return {
        server: serverWorker.url,
        web: webWorker.url,
      };
    }

    const widget = yield* Cloudflare.Turnstile.Widget("subscribe", {
      domains: turnstileDomains(),
      mode: "managed",
    });
    const serverWorker = yield* createServer(widget.secret);
    const webWorker = yield* createWeb(
      serverWorker.url.as<string>(),
      widget.sitekey
    );

    return {
      server: serverWorker.url,
      web: webWorker.url,
    };
  })
);
