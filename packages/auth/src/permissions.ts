import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

export const STAFF_ROLES = ["agent", "admin"] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export type UserRole = "user" | StaffRole;

export const statement = {
  ...defaultStatements,
  portal: ["access"],
} as const;

export const ac = createAccessControl(statement);

export const userRole = ac.newRole({
  portal: [],
  session: [],
  user: [],
});

export const agentRole = ac.newRole({
  portal: ["access"],
  session: [],
  user: [],
});

export const adminRole = ac.newRole({
  ...adminAc.statements,
  portal: ["access"],
});

export const roles = {
  admin: adminRole,
  agent: agentRole,
  user: userRole,
};

export function isStaffRole(
  role: string | null | undefined
): role is StaffRole {
  return role === "agent" || role === "admin";
}

export function hasStaffRole(role: string | string[] | null | undefined) {
  if (Array.isArray(role)) {
    return role.some((value) => isStaffRole(value));
  }

  return isStaffRole(role);
}

export function isAdminRole(role: string | string[] | null | undefined) {
  if (Array.isArray(role)) {
    return role.includes("admin");
  }

  return role === "admin";
}
