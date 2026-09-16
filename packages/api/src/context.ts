import type { Auth } from "@travel-agency/auth";
import type { EvlogOrpcContext } from "evlog/orpc";

export interface CreateContextOptions {
  auth: Auth;
  headers: Headers;
  log: EvlogOrpcContext["log"];
}

export async function createContext({
  auth,
  headers,
  log,
}: CreateContextOptions) {
  const session = await auth.api.getSession({
    headers,
  });
  return {
    log,
    session,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
