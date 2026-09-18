import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  client: {
    PUBLIC_SERVER_URL: z.url(),
    PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1),
  },
  clientPrefix: "PUBLIC_",
  emptyStringAsUndefined: true,
  runtimeEnv: (import.meta as any).env,
});
