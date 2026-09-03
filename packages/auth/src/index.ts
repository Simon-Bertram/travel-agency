import { createDb } from "@travel-agency/db";
import * as schema from "@travel-agency/db/schema/auth";
import { env } from "@travel-agency/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

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
    // uncomment cookieCache setting when ready to deploy to Cloudflare using *.workers.dev domains
    // session: {
    //   cookieCache: {
    //     enabled: true,
    //     maxAge: 60,
    //   },
    // },
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.CORS_ORIGIN],
  });
}
