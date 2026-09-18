import { hasStaffRole } from "@travel-kairos/auth/permissions";

export function destinationAfterSignIn(
  user:
    | {
        role?: string | string[] | null;
        twoFactorEnabled?: boolean | null;
      }
    | null
    | undefined
) {
  if (!(user && hasStaffRole(user.role))) {
    return "/dashboard";
  }

  if (!user.twoFactorEnabled) {
    return "/admin/setup-2fa";
  }

  return "/admin";
}
