import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { createContext } from "@travel-agency/api/context";
import { appRouter } from "@travel-agency/api/routers/index";
import { createAuth } from "@travel-agency/auth";
import { env } from "@travel-agency/env/server";
import {
  type BetterAuthInstance,
  createAuthMiddleware,
} from "evlog/better-auth";
import { type EvlogVariables, evlog, useLogger } from "evlog/hono";
import { initWorkersLogger } from "evlog/workers";
import { Hono } from "hono";
import { cors } from "hono/cors";

// Initialize wide-event structured logging for Cloudflare Workers
initWorkersLogger({
  env: { service: "travel-agency-server" },
});

const app = new Hono<EvlogVariables>();

// Evlog middleware: creates a wide event logger for each incoming request and enriches Cloudflare metadata
app.use(
  evlog({
    enrich: (ctx) => {
      const cfRay = ctx.headers?.["cf-ray"];
      if (cfRay) {
        ctx.event.cfRay = cfRay;
      }
    },
  })
);

// Auth logging middleware: attaches authenticated user info to the request log (masking emails)
app.use("*", async (c, next) => {
  const identifyUser = createAuthMiddleware(
    createAuth() as BetterAuthInstance,
    {
      exclude: ["/api/auth/**"],
      maskEmail: true,
    }
  );
  await identifyUser(c.get("log"), c.req.raw.headers, c.req.path);
  await next();
});

// Configure CORS for web client access
app.use(
  "/*",
  cors({
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    credentials: true,
    origin: env.CORS_ORIGIN,
  })
);

// Better Auth API routes (sign-in, sign-up, sessions, etc.)
app.on(["POST", "GET"], "/api/auth/*", (c) => createAuth().handler(c.req.raw));

// Helpers for Hono body proxy guard to prevent 'body already used' errors
const BODY_PARSER_METHODS = new Set([
  "arrayBuffer",
  "blob",
  "formData",
  "json",
  "text",
] as const);

type BodyParserMethod =
  typeof BODY_PARSER_METHODS extends Set<infer T> ? T : never;

function createBodyProxy(c: { req: { raw: Request } }) {
  return new Proxy(c.req.raw, {
    get(target, prop) {
      if (prop === "bodyUsed") {
        return false;
      }
      if (BODY_PARSER_METHODS.has(prop as BodyParserMethod)) {
        const fn = (c.req as unknown as Record<string, () => unknown>)[
          prop as string
        ];
        return () => fn?.call(c.req);
      }
      return Reflect.get(target, prop, target);
    },
  });
}

// Module-scoped oRPC handler (singleton for zero per-request recreation overhead)
export const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [
    onError((error) => {
      try {
        const log = useLogger();
        log.error(error instanceof Error ? error : new Error(String(error)));
      } catch {
        console.error(error);
      }
    }),
  ],
});

// Module-scoped OpenAPI handler (singleton with schema plugin initialized once)
export const apiHandler = new OpenAPIHandler(appRouter, {
  interceptors: [
    onError((error) => {
      try {
        const log = useLogger();
        log.error(error instanceof Error ? error : new Error(String(error)));
      } catch {
        console.error(error);
      }
    }),
  ],
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
    }),
  ],
});

// Route-scoped oRPC handler (/rpc/*) with body proxy guard
app.use("/rpc/*", async (c, next) => {
  const context = await createContext({ context: c });
  const request = createBodyProxy(c);

  const { matched, response } = await rpcHandler.handle(request, {
    context,
    prefix: "/rpc",
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  await next();
});

// Route-scoped OpenAPI documentation handler (/api-reference/*) with body proxy guard
app.use("/api-reference/*", async (c, next) => {
  const context = await createContext({ context: c });
  const request = createBodyProxy(c);

  const { matched, response } = await apiHandler.handle(request, {
    context,
    prefix: "/api-reference",
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  await next();
});

// Attach unhandled server errors to the evlog wide event
app.onError((error, c) => {
  c.get("log").error(error);
  return c.text("Internal Server Error", 500);
});

// Basic health check endpoint
app.get("/", (c) => c.text("OK"));

export default app;
