import { eq } from "drizzle-orm";

import type { createDb } from "./index";
import { user } from "./schema/auth";

export async function promoteAdminByEmail(
  db: ReturnType<typeof createDb>,
  email: string
) {
  const normalized = email.trim().toLowerCase();
  const updated = await db
    .update(user)
    .set({ role: "admin" })
    .where(eq(user.email, normalized))
    .returning({
      email: user.email,
      id: user.id,
      role: user.role,
    });

  return updated[0] ?? null;
}
