import { describe, expect, it } from "vitest";
import {
  ALL_PERMISSIONS,
  ASSIGNABLE_PERMISSIONS,
  DEFAULT_STAFF_PERMISSIONS,
  OWNER_ONLY_PERMISSIONS,
  PERMISSIONS,
  canManageAdmins,
  hasPermission,
  requirePermission,
} from "@/lib/permissions";

describe("permissions", () => {
  it("gives owners every permission, including owner-only actions", () => {
    for (const permission of ALL_PERMISSIONS) {
      expect(hasPermission({ role: "owner", permissions: [] }, permission)).toBe(true);
    }
  });

  it("gives admins assignable permissions but not ownership/delete", () => {
    for (const permission of ASSIGNABLE_PERMISSIONS) {
      expect(hasPermission({ role: "admin", permissions: [] }, permission)).toBe(true);
    }
    for (const permission of OWNER_ONLY_PERMISSIONS) {
      expect(hasPermission({ role: "admin", permissions: [] }, permission)).toBe(false);
    }
  });

  it("limits staff to explicitly granted permissions", () => {
    const staff = { role: "staff" as const, permissions: DEFAULT_STAFF_PERMISSIONS };
    expect(hasPermission(staff, PERMISSIONS.JOBS_VIEW)).toBe(true);
    expect(hasPermission(staff, PERMISSIONS.PAYMENTS_MANAGE)).toBe(false);
    expect(hasPermission(staff, PERMISSIONS.SETTINGS_MANAGE)).toBe(false);
    expect(hasPermission({ role: "staff", permissions: null }, PERMISSIONS.JOBS_VIEW)).toBe(false);
  });

  it("throws when a permission is missing", () => {
    expect(() =>
      requirePermission({ role: "staff", permissions: [] }, PERMISSIONS.INVOICES_MANAGE),
    ).toThrow(/FORBIDDEN/);
  });

  it("keeps owner-only permissions out of the assignable list", () => {
    expect(canManageAdmins("owner")).toBe(true);
    expect(canManageAdmins("admin")).toBe(false);
    for (const permission of OWNER_ONLY_PERMISSIONS) {
      expect(ASSIGNABLE_PERMISSIONS).not.toContain(permission);
    }
  });
});
