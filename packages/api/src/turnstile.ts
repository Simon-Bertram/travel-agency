import { env } from "@travel-kairos/env/server";

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const SITEVERIFY_TIMEOUT_MS = 10_000;
const TURNSTILE_DUMMY_SECRET_KEY = "1x0000000000000000000000000000000AA";
const TURNSTILE_DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";
const TURNSTILE_ACTION = "subscribe";

interface SiteverifyResponse {
  action?: string;
  "error-codes"?: string[];
  success?: boolean;
}

export async function verifyTurnstileToken(
  token: string,
  remoteIp: string | undefined
): Promise<boolean> {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!(secret && token.length > 0 && token.length <= 2048)) {
    return false;
  }

  if (secret === TURNSTILE_DUMMY_SECRET_KEY) {
    return token === TURNSTILE_DUMMY_TOKEN;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, SITEVERIFY_TIMEOUT_MS);

  try {
    const response = await fetch(SITEVERIFY_URL, {
      body: JSON.stringify({
        remoteip: remoteIp,
        response: token,
        secret,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: controller.signal,
    });
    const result = (await response.json()) as SiteverifyResponse;
    return result.success === true && result.action === TURNSTILE_ACTION;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
