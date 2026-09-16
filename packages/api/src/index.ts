import { os } from "@orpc/server";
import { createError } from "evlog";
import { evlog } from "evlog/orpc";

import type { Context } from "./context";

// oRPC builder typed with per-request Context (session + Hono logger).
export const o = os.$context<Context>();

// Unauthenticated procedures — anyone can call these.
export const publicProcedure = o.use(evlog());

// Rejects missing session.user, then narrows context so handlers see a defined session.
const requireAuth = o.middleware(async ({ context, next }) => {
  if (!context.session?.user) {
    throw createError({
      code: "UNAUTHORIZED",
      fix: "Sign in and retry the request.",
      message: "Please log in to continue",
      status: 401,
      why: "No authenticated session was present on the request.",
    });
  }
  return await next({
    context: {
      log: context.log,
      session: context.session,
    },
  });
});

// publicProcedure with requireAuth — staff/private routes use this.
export const protectedProcedure = publicProcedure.use(requireAuth);
