import { os } from "@orpc/server";
import { hasStaffRole, isAdminRole } from "@travel-kairos/auth/permissions";
import { createError } from "evlog";
import { evlog } from "evlog/orpc";

import type { Context } from "./context";

// oRPC builder typed with per-request Context (session + Hono logger).
export const o = os.$context<Context>();

// Unauthenticated procedures — anyone can call these.
export const publicProcedure = o.use(evlog());

function isTwoFactorEnabled(user: { twoFactorEnabled?: boolean | null }) {
  return user.twoFactorEnabled === true;
}

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
      auth: context.auth,
      headers: context.headers,
      log: context.log,
      session: context.session,
    },
  });
});

const requireStaff = o.middleware(async ({ context, next }) => {
  if (!context.session?.user) {
    throw createError({
      code: "UNAUTHORIZED",
      fix: "Sign in and retry the request.",
      message: "Please log in to continue",
      status: 401,
      why: "No authenticated session was present on the request.",
    });
  }

  if (!hasStaffRole(context.session.user.role)) {
    throw createError({
      code: "FORBIDDEN",
      fix: "Sign in with a staff account.",
      message: "Staff access required",
      status: 403,
      why: "This procedure is limited to travel agents and admins.",
    });
  }

  if (!isTwoFactorEnabled(context.session.user)) {
    throw createError({
      code: "FORBIDDEN",
      fix: "Enroll authenticator 2FA, then retry.",
      message: "Two-factor authentication is required",
      status: 403,
      why: "Staff accounts must enable TOTP before using the admin portal.",
    });
  }

  return await next({
    context: {
      auth: context.auth,
      headers: context.headers,
      log: context.log,
      session: context.session,
    },
  });
});

const requireAdmin = o.middleware(async ({ context, next }) => {
  if (!context.session?.user) {
    throw createError({
      code: "UNAUTHORIZED",
      fix: "Sign in and retry the request.",
      message: "Please log in to continue",
      status: 401,
      why: "No authenticated session was present on the request.",
    });
  }

  if (!isAdminRole(context.session.user.role)) {
    throw createError({
      code: "FORBIDDEN",
      fix: "Sign in with an admin account.",
      message: "Admin access required",
      status: 403,
      why: "Only admins can manage travel agent accounts.",
    });
  }

  return await next({
    context: {
      auth: context.auth,
      headers: context.headers,
      log: context.log,
      session: context.session,
    },
  });
});

// publicProcedure with requireAuth — staff/private routes use this.
export const protectedProcedure = publicProcedure.use(requireAuth);

export const staffProcedure = protectedProcedure.use(requireStaff);

export const adminProcedure = staffProcedure.use(requireAdmin);
