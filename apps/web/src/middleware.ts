import { defineMiddleware } from "astro:middleware";
import { createWorkersLogger, initWorkersLogger } from "evlog/workers";

initWorkersLogger({
  env: { service: "travel-agency-web" },
});

export const onRequest = defineMiddleware(async ({ request, locals }, next) => {
  const executionCtx = locals.cfContext ?? (locals as Record<string, any>).runtime?.ctx;
  const log = createWorkersLogger(request, {
    executionCtx,
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
