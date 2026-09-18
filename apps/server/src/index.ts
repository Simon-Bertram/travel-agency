import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { createContext } from "@travel-kairos/api/context";
import { appRouter } from "@travel-kairos/api/routers/index";
import { createAuth } from "@travel-kairos/auth";
import { createDb } from "@travel-kairos/db";
import { promoteAdminByEmail } from "@travel-kairos/db/promote-admin";
import { env } from "@travel-kairos/env/server";
import { createAxiomDrain } from "evlog/axiom";
import { createAuthMiddleware } from "evlog/better-auth";
import { type EvlogVariables, evlog } from "evlog/hono";
import {
  createMemoryDrain,
  parseReadMemoryLogsQuery,
  readMemoryLogs,
} from "evlog/memory";
import { initWorkersLogger } from "evlog/workers";
import { Hono, type Context as HonoContext } from "hono";
import { cors } from "hono/cors";

const isDev =
  env.EVLOG_DEV === "1" || !(env.AXIOM_API_KEY && env.AXIOM_DATASET);

initWorkersLogger({
  env: { service: "travel-kairos-server" },
});

const auth = createAuth();
const identifyUser = createAuthMiddleware(auth, {
  exclude: ["/api/auth/**"],
  maskEmail: true,
});

const app = new Hono<EvlogVariables>();

const allowedOrigins = new Set([env.CORS_ORIGIN, "http://localhost:4321"]);

app.use(
  evlog({
    drain: isDev ? createMemoryDrain() : createAxiomDrain(),
    enrich: (ctx) => {
      const cfRay = ctx.headers?.["cf-ray"];
      if (cfRay) {
        ctx.event.cfRay = cfRay;
      }
    },
    exclude: ["/_evlog/**"],
  })
);

app.use("*", async (c, next) => {
  const log = c.get("log");
  if (log) {
    await identifyUser(log, c.req.raw.headers, c.req.path);
  }
  await next();
});

app.use(
  "/*",
  cors({
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    credentials: true,
    origin: (origin) => (allowedOrigins.has(origin) ? origin : ""),
  })
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

function isLocalHost(c: HonoContext) {
  const [host] = (c.req.header("host") ?? "").split(":");
  return host === "localhost" || host === "127.0.0.1";
}

if (isDev) {
  app.get("/_evlog/logs", (c) => {
    if (!isLocalHost(c)) {
      return c.notFound();
    }
    return c.json(readMemoryLogs(parseReadMemoryLogsQuery(c.req.query())));
  });

  app.post("/_dev/promote-admin", async (c) => {
    if (!isLocalHost(c)) {
      return c.notFound();
    }

    const body = await c.req.json().catch(() => null);
    const email =
      body && typeof body === "object" && "email" in body
        ? body.email
        : undefined;

    if (typeof email !== "string" || email.trim().length === 0) {
      return c.json({ message: "Provide an email to promote." }, 400);
    }

    const promoted = await promoteAdminByEmail(createDb(), email);
    if (!promoted) {
      return c.json({ message: "No user found with that email." }, 404);
    }

    return c.json(promoted);
  });
}

// Hono may consume the body before oRPC; proxy parsers back to Hono's cache.
const BODY_PARSER_METHODS = new Set([
  "arrayBuffer",
  "blob",
  "formData",
  "json",
  "text",
] as const);

type BodyParserMethod =
  typeof BODY_PARSER_METHODS extends Set<infer T> ? T : never;

function createBodyProxy(c: HonoContext) {
  return new Proxy(c.req.raw, {
    get(target, prop) {
      if (prop === "bodyUsed") {
        return false;
      }
      if (BODY_PARSER_METHODS.has(prop as BodyParserMethod)) {
        return () => c.req[prop as BodyParserMethod]();
      }
      return Reflect.get(target, prop, target);
    },
  });
}

// Module-scoped so isolates reuse handlers instead of recreating them per request.
export const rpcHandler = new RPCHandler(appRouter);

export const apiHandler = new OpenAPIHandler(appRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
    }),
  ],
});

function mountOrpc(
  path: "/rpc" | "/api-reference",
  handler: typeof rpcHandler | typeof apiHandler
) {
  app.use(`${path}/*`, async (c, next) => {
    const context = await createContext({
      auth,
      headers: c.req.raw.headers,
      log: c.get("log"),
    });
    const { matched, response } = await handler.handle(createBodyProxy(c), {
      context,
      prefix: path,
    });

    if (matched) {
      return c.newResponse(response.body, response);
    }

    await next();
  });
}

mountOrpc("/rpc", rpcHandler);
mountOrpc("/api-reference", apiHandler);

app.onError((error, c) => {
  c.get("log")?.error(error);
  return c.json({ message: "Internal Server Error" }, 500);
});

app.get("/", (c) => c.text("OK"));

export default app;
