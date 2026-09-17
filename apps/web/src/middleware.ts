import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import { createAxiomDrain } from "evlog/axiom";
import { createMemoryDrain } from "evlog/memory";
import { createWorkersLogger, initWorkersLogger } from "evlog/workers";

const isDev =
  env.EVLOG_DEV === "1" || !(env.AXIOM_API_KEY && env.AXIOM_DATASET);

initWorkersLogger({
  drain: isDev ? createMemoryDrain() : createAxiomDrain(),
  env: { service: "travel-kairos-web" },
});

export const onRequest = defineMiddleware(async ({ request, locals }, next) => {
  const log = createWorkersLogger(request, {
    executionCtx: locals.cfContext,
  });

  locals.log = log;

  try {
    const response = await next();
    log.emit();
    return response;
  } catch (error) {
    log.error(error instanceof Error ? error : new Error(String(error)));
    log.emit();
    throw error;
  }
});
