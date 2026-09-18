import { createDb } from "@travel-kairos/db";
// biome-ignore lint/performance/noNamespaceImport: drizzleAdapter needs the full schema module
import * as schema from "@travel-kairos/db/schema/auth";
import { env } from "@travel-kairos/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { admin } from "better-auth/plugins/admin";
import { twoFactor } from "better-auth/plugins/two-factor";

import { ac, hasStaffRole, roles } from "./permissions";

export function createAuth() {
  const db = createDb();

  return betterAuth({
    advanced: {
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "none",
        secure: true,
      },
      // uncomment crossSubDomainCookies setting when ready to deploy and replace <your-workers-subdomain> with your actual workers subdomain
      // https://developers.cloudflare.com/workers/wrangler/configuration/#workersdev
      // crossSubDomainCookies: {
      //   enabled: true,
      //   domain: "<your-workers-subdomain>",
      // },
    },
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(db, {
      provider: "sqlite",

      schema,
    }),
    emailAndPassword: {
      enabled: true,
    },
    hooks: {
      before: createAuthMiddleware((ctx) => {
        if (ctx.path !== "/two-factor/disable") {
          return Promise.resolve();
        }

        const role = ctx.context.session?.user.role;
        if (
          hasStaffRole(
            typeof role === "string" || Array.isArray(role) ? role : undefined
          )
        ) {
          throw new APIError("FORBIDDEN", {
            message: "Staff accounts cannot disable two-factor authentication.",
          });
        }

        return Promise.resolve();
      }),
    },
    plugins: [
      admin({
        ac,
        defaultRole: "user",
        roles,
      }),
      twoFactor({
        issuer: "Travel Kairos",
      }),
    ],
    // uncomment cookieCache setting when ready to deploy to Cloudflare using *.workers.dev domains
    // session: {
    //   cookieCache: {
    //     enabled: true,
    //     maxAge: 60,
    //   },
    // },
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [...new Set([env.CORS_ORIGIN, "http://localhost:4321"])],
  });
}

export type Auth = ReturnType<typeof createAuth>;
