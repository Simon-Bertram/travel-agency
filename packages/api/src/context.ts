import type { Auth } from "@travel-kairos/auth";
import type { EvlogOrpcContext } from "evlog/orpc";

export interface StaffUser {
  email: string;
  emailVerified?: boolean;
  id: string;
  image?: string | null;
  name: string;
  role?: string | string[] | null;
  twoFactorEnabled?: boolean | null;
}

export interface StaffSession {
  session: { id: string };
  user: StaffUser;
}

export interface CreateContextOptions {
  auth: Auth;
  headers: Headers;
  log: EvlogOrpcContext["log"];
}

export interface Context {
  auth: {
    api: {
      createUser: (args: {
        body: {
          email: string;
          name: string;
          password: string;
          role?: string;
        };
        headers: Headers;
      }) => Promise<{ user: StaffUser }>;
      listUsers: (args: {
        headers: Headers;
        query?: { limit?: number };
      }) => Promise<{ users: StaffUser[] }>;
    };
  };
  headers: Headers;
  log: EvlogOrpcContext["log"];
  session: StaffSession | null;
}

export async function createContext({
  auth,
  headers,
  log,
}: CreateContextOptions): Promise<Context> {
  const session = await auth.api.getSession({
    headers,
  });

  return {
    auth,
    headers,
    log,
    session,
  } as Context;
}
