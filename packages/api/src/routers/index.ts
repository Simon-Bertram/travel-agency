import type { RouterClient } from "@orpc/server";
import { hasStaffRole } from "@travel-kairos/auth/permissions";
import { createDb } from "@travel-kairos/db";
import { subscriber } from "@travel-kairos/db/schema/subscriber";
import { env } from "@travel-kairos/env/server";
import { createError } from "evlog";
import { z } from "zod";

import {
  adminProcedure,
  protectedProcedure,
  publicProcedure,
  staffProcedure,
} from "../index";
import { verifyTurnstileToken } from "../turnstile";

const TEMPORARY_PASSWORD_LENGTH = 24;

const MOCK_ENQUIRIES = [
  {
    destination: "Kyoto",
    id: "enq_1008",
    name: "Elena Voss",
    receivedAt: "2026-09-16",
    status: "New",
  },
  {
    destination: "Amalfi Coast",
    id: "enq_1007",
    name: "James Whitfield",
    receivedAt: "2026-09-15",
    status: "In review",
  },
  {
    destination: "Patagonia",
    id: "enq_1006",
    name: "Sofia Marchand",
    receivedAt: "2026-09-14",
    status: "Awaiting dates",
  },
] as const;

const MOCK_DEALS = [
  {
    departure: "2026-10-12",
    id: "deal_204",
    status: "Active",
    title: "Amalfi late-season villa",
  },
  {
    departure: "2026-11-03",
    id: "deal_198",
    status: "Active",
    title: "Kyoto machiya week",
  },
  {
    departure: "2026-12-19",
    id: "deal_191",
    status: "Held",
    title: "Patagonia private estancia",
  },
] as const;

function generateTemporaryPassword() {
  const bytes = new Uint8Array(TEMPORARY_PASSWORD_LENGTH);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "")
    .replaceAll("/", "")
    .replaceAll("=", "")
    .slice(0, TEMPORARY_PASSWORD_LENGTH);
}

function subscribeRejected() {
  throw createError({
    code: "BAD_REQUEST",
    fix: "Complete the challenge and retry.",
    message: "Could not subscribe right now",
    status: 400,
    why: "The subscribe request failed abuse checks or verification.",
  });
}

async function allowSubscribeAttempt(
  ip: string,
  email: string
): Promise<boolean> {
  try {
    const [ipLimit, emailLimit] = await Promise.all([
      env.SUBSCRIBE_RATE_LIMIT.limit({ key: `ip:${ip}` }),
      env.SUBSCRIBE_RATE_LIMIT.limit({ key: `email:${email}` }),
    ]);
    return ipLimit.success && emailLimit.success;
  } catch {
    return true;
  }
}

export const appRouter = {
  healthCheck: publicProcedure.handler(() => "OK"),
  privateData: protectedProcedure.handler(({ context }) => ({
    message: "This is private",
    user: context.session?.user,
  })),
  staff: {
    createAgent: adminProcedure
      .input(
        z.object({
          email: z.email(),
          name: z.string().trim().min(1),
        })
      )
      .handler(async ({ context, input }) => {
        const password = generateTemporaryPassword();

        try {
          const created = await context.auth.api.createUser({
            body: {
              email: input.email.trim().toLowerCase(),
              name: input.name.trim(),
              password,
              role: "agent",
            },
            headers: context.headers,
          });

          return {
            password,
            user: created.user,
          };
        } catch (error) {
          throw createError({
            cause: error instanceof Error ? error : undefined,
            code: "BAD_REQUEST",
            fix: "Check the email is unused, then retry.",
            message: "Could not create the travel agent account",
            status: 400,
            why: "Better Auth rejected the admin create-user request.",
          });
        }
      }),
    dashboard: staffProcedure.handler(() => ({
      deals: MOCK_DEALS,
      enquiries: MOCK_ENQUIRIES,
    })),
    listStaff: adminProcedure.handler(async ({ context }) => {
      const result = await context.auth.api.listUsers({
        headers: context.headers,
        query: {
          limit: 100,
        },
      });

      return result.users.filter((staffUser) => hasStaffRole(staffUser.role));
    }),
  },
  subscribe: publicProcedure
    .input(
      z.object({
        email: z.email(),
        turnstileToken: z.string().trim().min(1).max(2048),
        website: z.string().optional(),
      })
    )
    .handler(async ({ context, input }) => {
      if (input.website?.trim()) {
        return { ok: true as const };
      }

      const email = input.email.trim().toLowerCase();
      const ip = context.headers.get("CF-Connecting-IP") ?? "unknown";

      if (!(await allowSubscribeAttempt(ip, email))) {
        subscribeRejected();
      }

      const verified = await verifyTurnstileToken(input.turnstileToken, ip);
      if (!verified) {
        subscribeRejected();
      }

      await createDb()
        .insert(subscriber)
        .values({
          email,
          id: crypto.randomUUID(),
        })
        .onConflictDoNothing();

      return { ok: true as const };
    }),
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
