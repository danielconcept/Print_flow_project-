export const PERMISSIONS = {
  CUSTOMERS_VIEW: "customers.view",
  CUSTOMERS_MANAGE: "customers.manage",
  SERVICES_VIEW: "services.view",
  SERVICES_MANAGE: "services.manage",
  QUOTATIONS_VIEW: "quotations.view",
  QUOTATIONS_MANAGE: "quotations.manage",
  JOBS_VIEW: "jobs.view",
  JOBS_MANAGE: "jobs.manage",
  JOBS_UPDATE_STATUS: "jobs.update_status",
  JOBS_CONSUME_MATERIALS: "jobs.consume_materials",
  ARTWORK_VIEW: "artwork.view",
  ARTWORK_MANAGE: "artwork.manage",
  ARTWORK_APPROVE: "artwork.approve",
  INVOICES_VIEW: "invoices.view",
  INVOICES_MANAGE: "invoices.manage",
  INVOICES_VOID: "invoices.void",
  PAYMENTS_VIEW: "payments.view",
  PAYMENTS_MANAGE: "payments.manage",
  PAYMENTS_REVERSE: "payments.reverse",
  INVENTORY_VIEW: "inventory.view",
  INVENTORY_MANAGE: "inventory.manage",
  INVENTORY_ADJUST: "inventory.adjust",
  SUPPLIERS_VIEW: "suppliers.view",
  SUPPLIERS_MANAGE: "suppliers.manage",
  PURCHASES_VIEW: "purchases.view",
  PURCHASES_MANAGE: "purchases.manage",
  PURCHASES_RECEIVE: "purchases.receive",
  EXPENSES_VIEW: "expenses.view",
  EXPENSES_MANAGE: "expenses.manage",
  REPORTS_VIEW: "reports.view",
  REPORTS_FINANCIAL: "reports.financial",
  REPORTS_EXPORT: "reports.export",
  STAFF_VIEW: "staff.view",
  STAFF_MANAGE: "staff.manage",
  SETTINGS_VIEW: "settings.view",
  SETTINGS_MANAGE: "settings.manage",
  AUDIT_VIEW: "audit.view",
  NOTIFICATIONS_VIEW: "notifications.view",
  COMPANY_TRANSFER_OWNERSHIP: "company.transfer_ownership",
  COMPANY_DELETE: "company.delete",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export type CompanyRole = "owner" | "admin" | "staff";

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

export const OWNER_ONLY_PERMISSIONS: Permission[] = [
  PERMISSIONS.COMPANY_TRANSFER_OWNERSHIP,
  PERMISSIONS.COMPANY_DELETE,
];

export const ASSIGNABLE_PERMISSIONS: Permission[] = ALL_PERMISSIONS.filter(
  (permission) => !OWNER_ONLY_PERMISSIONS.includes(permission),
);

export const DEFAULT_STAFF_PERMISSIONS: Permission[] = [
  PERMISSIONS.CUSTOMERS_VIEW,
  PERMISSIONS.CUSTOMERS_MANAGE,
  PERMISSIONS.QUOTATIONS_VIEW,
  PERMISSIONS.QUOTATIONS_MANAGE,
  PERMISSIONS.JOBS_VIEW,
  PERMISSIONS.JOBS_MANAGE,
  PERMISSIONS.JOBS_UPDATE_STATUS,
  PERMISSIONS.ARTWORK_VIEW,
  PERMISSIONS.ARTWORK_MANAGE,
  PERMISSIONS.INVOICES_VIEW,
  PERMISSIONS.PAYMENTS_VIEW,
  PERMISSIONS.INVENTORY_VIEW,
  PERMISSIONS.REPORTS_VIEW,
  PERMISSIONS.NOTIFICATIONS_VIEW,
];

export interface PermissionSubject {
  role: CompanyRole;
  permissions: string[] | null | undefined;
}

export function hasPermission(
  subject: PermissionSubject | null | undefined,
  permission: Permission | string,
): boolean {
  if (!subject) return false;
  if (subject.role === "owner") return true;
  if (subject.role === "admin") {
    return !OWNER_ONLY_PERMISSIONS.includes(permission as Permission);
  }
  return (subject.permissions ?? []).includes(permission);
}

export function requirePermission(
  subject: PermissionSubject | null | undefined,
  permission: Permission | string,
): void {
  if (!hasPermission(subject, permission)) {
    throw new Error("FORBIDDEN");
  }
}

export function canManageAdmins(role: CompanyRole): boolean {
  return role === "owner";
}

export const PERMISSION_GROUPS: Array<{
  label: string;
  permissions: Array<{ value: Permission; label: string; description: string }>;
}> = [
  {
    label: "Customers",
    permissions: [
      { value: PERMISSIONS.CUSTOMERS_VIEW, label: "View customers", description: "View customer records and history" },
      { value: PERMISSIONS.CUSTOMERS_MANAGE, label: "Manage customers", description: "Create, edit and archive customers" },
    ],
  },
  {
    label: "Quotations and jobs",
    permissions: [
      { value: PERMISSIONS.QUOTATIONS_VIEW, label: "View quotations", description: "View quotations and prices" },
      { value: PERMISSIONS.QUOTATIONS_MANAGE, label: "Manage quotations", description: "Create and update quotations" },
      { value: PERMISSIONS.JOBS_VIEW, label: "View jobs", description: "View jobs and production information" },
      { value: PERMISSIONS.JOBS_MANAGE, label: "Manage jobs", description: "Create jobs, cancel and authorise rework" },
      { value: PERMISSIONS.JOBS_UPDATE_STATUS, label: "Update job status", description: "Move jobs through production" },
      { value: PERMISSIONS.JOBS_CONSUME_MATERIALS, label: "Record material use", description: "Consume stock against production jobs" },
    ],
  },
  {
    label: "Artwork",
    permissions: [
      { value: PERMISSIONS.ARTWORK_VIEW, label: "View artwork", description: "Open private artwork files" },
      { value: PERMISSIONS.ARTWORK_MANAGE, label: "Upload artwork", description: "Upload and revise artwork files" },
      { value: PERMISSIONS.ARTWORK_APPROVE, label: "Approve artwork", description: "Record customer artwork decisions" },
    ],
  },
  {
    label: "Finance",
    permissions: [
      { value: PERMISSIONS.INVOICES_VIEW, label: "View invoices", description: "View invoices and balances" },
      { value: PERMISSIONS.INVOICES_MANAGE, label: "Manage invoices", description: "Create and issue invoices" },
      { value: PERMISSIONS.INVOICES_VOID, label: "Void invoices", description: "Void unpaid invoices with a reason" },
      { value: PERMISSIONS.PAYMENTS_VIEW, label: "View payments", description: "View payment records and allocations" },
      { value: PERMISSIONS.PAYMENTS_MANAGE, label: "Record payments", description: "Record and allocate customer payments" },
      { value: PERMISSIONS.PAYMENTS_REVERSE, label: "Reverse payments", description: "Reverse payments and restore balances" },
      { value: PERMISSIONS.EXPENSES_VIEW, label: "View expenses", description: "View operating expenses" },
      { value: PERMISSIONS.EXPENSES_MANAGE, label: "Manage expenses", description: "Record expenses and receipts" },
      { value: PERMISSIONS.REPORTS_FINANCIAL, label: "Financial reports", description: "View revenue, profit and debt reports" },
      { value: PERMISSIONS.REPORTS_EXPORT, label: "Export reports", description: "Export financial and operational data" },
    ],
  },
  {
    label: "Inventory and purchasing",
    permissions: [
      { value: PERMISSIONS.INVENTORY_VIEW, label: "View inventory", description: "View stock levels and movements" },
      { value: PERMISSIONS.INVENTORY_MANAGE, label: "Manage inventory", description: "Create materials and recipes" },
      { value: PERMISSIONS.INVENTORY_ADJUST, label: "Adjust stock", description: "Perform stock counts, adjustments and waste" },
      { value: PERMISSIONS.SUPPLIERS_VIEW, label: "View suppliers", description: "View supplier records" },
      { value: PERMISSIONS.SUPPLIERS_MANAGE, label: "Manage suppliers", description: "Create and edit suppliers" },
      { value: PERMISSIONS.PURCHASES_VIEW, label: "View purchases", description: "View purchase orders" },
      { value: PERMISSIONS.PURCHASES_MANAGE, label: "Manage purchases", description: "Create and cancel purchase orders" },
      { value: PERMISSIONS.PURCHASES_RECEIVE, label: "Receive goods", description: "Receive stock against purchase orders" },
    ],
  },
  {
    label: "Administration",
    permissions: [
      { value: PERMISSIONS.REPORTS_VIEW, label: "View reports", description: "View operational reports" },
      { value: PERMISSIONS.SERVICES_VIEW, label: "View services", description: "View the service catalogue" },
      { value: PERMISSIONS.SERVICES_MANAGE, label: "Manage services", description: "Create and edit print services" },
      { value: PERMISSIONS.STAFF_VIEW, label: "View staff", description: "View staff members and invitations" },
      { value: PERMISSIONS.STAFF_MANAGE, label: "Manage staff", description: "Invite staff and change permissions" },
      { value: PERMISSIONS.SETTINGS_VIEW, label: "View settings", description: "View company settings" },
      { value: PERMISSIONS.SETTINGS_MANAGE, label: "Manage settings", description: "Change company, tax and document settings" },
      { value: PERMISSIONS.AUDIT_VIEW, label: "View audit log", description: "View administrative and financial audit history" },
      { value: PERMISSIONS.NOTIFICATIONS_VIEW, label: "View notifications", description: "View in-app notifications" },
    ],
  },
];
