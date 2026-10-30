import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppError } from "@/lib/errors";
import { hasPermission, type CompanyRole, type Permission } from "@/lib/permissions";
import type { Json, Tables } from "./types";
import { createServerSupabaseClient } from "./server";

export const ACTIVE_COMPANY_COOKIE = "pf_company";

export interface CompanyTaxSettings {
  default_rate: number;
  prices_include_tax: boolean;
  tax_label: string;
}

export interface CompanySettings {
  payment_methods?: string[];
  expense_categories?: string[];
  quotation_terms?: string;
  invoice_footer?: string;
}

export interface ActiveCompany {
  id: string;
  name: string;
  slug: string;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  logoPath: string | null;
  currency: string;
  timezone: string;
  taxSettings: CompanyTaxSettings;
  settings: CompanySettings;
}

export interface ActiveMembership {
  id: string;
  companyId: string;
  role: CompanyRole;
  permissions: string[];
}

export interface AuthProfile {
  id: string;
  fullName: string;
  phone: string | null;
}

export interface SessionContext {
  user: { id: string; email: string | null };
  profile: AuthProfile | null;
  membership: ActiveMembership | null;
  memberships: ActiveMembership[];
  company: ActiveCompany | null;
  companies: ActiveCompany[];
}

function parseTaxSettings(value: Json): CompanyTaxSettings {
  const object =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, Json | undefined>)
      : {};
  return {
    default_rate: Number(object.default_rate ?? 0) || 0,
    prices_include_tax: Boolean(object.prices_include_tax ?? false),
    tax_label: typeof object.tax_label === "string" ? object.tax_label : "VAT",
  };
}

function parseCompanySettings(value: Json): CompanySettings {
  const object =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, Json | undefined>)
      : {};
  return {
    payment_methods: Array.isArray(object.payment_methods)
      ? object.payment_methods.filter((item): item is string => typeof item === "string")
      : undefined,
    expense_categories: Array.isArray(object.expense_categories)
      ? object.expense_categories.filter((item): item is string => typeof item === "string")
      : undefined,
    quotation_terms: typeof object.quotation_terms === "string" ? object.quotation_terms : undefined,
    invoice_footer: typeof object.invoice_footer === "string" ? object.invoice_footer : undefined,
  };
}

function mapCompany(row: Tables<"companies">): ActiveCompany {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    legalName: row.legal_name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    logoPath: row.logo_path,
    currency: row.currency,
    timezone: row.timezone,
    taxSettings: parseTaxSettings(row.tax_settings),
    settings: parseCompanySettings(row.settings),
  };
}

function mapMembership(row: Tables<"company_memberships">): ActiveMembership {
  return {
    id: row.id,
    companyId: row.company_id,
    role: row.role as CompanyRole,
    permissions: row.permissions,
  };
}

export const getSessionContext = cache(async (): Promise<SessionContext> => {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) {
    return {
      user: { id: "", email: null },
      profile: null,
      membership: null,
      memberships: [],
      company: null,
      companies: [],
    };
  }

  const userId = data.claims.sub;
  const email = typeof data.claims.email === "string" ? data.claims.email : null;

  const [profileResult, membershipResult] = await Promise.all([
    supabase.from("profiles").select("id, full_name, phone").eq("id", userId).maybeSingle(),
    supabase
      .from("company_memberships")
      .select("id, company_id, role, permissions, status")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: true }),
  ]);

  const memberships = ((membershipResult.data ?? []) as Tables<"company_memberships">[]).map(
    mapMembership,
  );
  const profile = profileResult.data
    ? {
        id: profileResult.data.id,
        fullName: profileResult.data.full_name,
        phone: profileResult.data.phone,
      }
    : null;

  let companies: ActiveCompany[] = [];
  if (memberships.length > 0) {
    const companyResult = await supabase
      .from("companies")
      .select(
        "id, name, slug, legal_name, email, phone, address, logo_path, currency, timezone, tax_settings, settings",
      )
      .in(
        "id",
        memberships.map((membership) => membership.companyId),
      )
      .is("archived_at", null);
    companies = ((companyResult.data ?? []) as Tables<"companies">[]).map(mapCompany);
  }

  const companyIds = new Set(companies.map((company) => company.id));
  const visibleMemberships = memberships.filter((membership) => companyIds.has(membership.companyId));
  const cookieStore = await cookies();
  const preferredCompanyId = cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value;
  const membership =
    visibleMemberships.find((item) => item.companyId === preferredCompanyId) ??
    visibleMemberships[0] ??
    null;
  const company = membership
    ? (companies.find((item) => item.id === membership.companyId) ?? null)
    : null;

  return {
    user: { id: userId, email },
    profile,
    membership,
    memberships: visibleMemberships,
    company,
    companies: companies.filter((item) =>
      visibleMemberships.some((membership) => membership.companyId === item.id),
    ),
  };
});

export async function getSupabaseAndSession() {
  const supabase = await createServerSupabaseClient();
  const context = await getSessionContext();
  return { supabase, ...context };
}

export async function requireUser(): Promise<SessionContext & { user: { id: string; email: string | null } }> {
  const context = await getSessionContext();
  if (!context.user.id) {
    redirect("/login");
  }
  return context as SessionContext & { user: { id: string; email: string | null } };
}

export async function requireCompany(): Promise<
  SessionContext & {
    user: { id: string; email: string | null };
    membership: ActiveMembership;
    company: ActiveCompany;
  }
> {
  const context = await requireUser();
  if (!context.company || !context.membership) {
    redirect("/onboarding");
  }
  return context as SessionContext & {
    user: { id: string; email: string | null };
    membership: ActiveMembership;
    company: ActiveCompany;
  };
}

export async function requirePermissionPage(permission: Permission): Promise<
  SessionContext & {
    user: { id: string; email: string | null };
    membership: ActiveMembership;
    company: ActiveCompany;
  }
> {
  const context = await requireCompany();
  if (!hasPermission(context.membership, permission)) {
    redirect("/dashboard?error=forbidden");
  }
  return context;
}

export async function requirePermissionApi(permission: Permission): Promise<
  SessionContext & {
    user: { id: string; email: string | null };
    membership: ActiveMembership;
    company: ActiveCompany;
  }
> {
  const context = await getSessionContext();
  if (!context.user.id) {
    throw new AppError("AUTH_REQUIRED", "Authentication required.", "Please sign in to continue.", 401);
  }
  if (!context.company || !context.membership) {
    throw new AppError("COMPANY_REQUIRED", "Company membership required.", "Complete workspace setup first.", 403);
  }
  if (!hasPermission(context.membership, permission)) {
    throw new AppError("FORBIDDEN", "Permission denied.", "You do not have permission to perform this action.", 403);
  }
  return context as SessionContext & {
    user: { id: string; email: string | null };
    membership: ActiveMembership;
    company: ActiveCompany;
  };
}

export function can(
  context: Pick<SessionContext, "membership">,
  permission: Permission | string,
): boolean {
  return hasPermission(context.membership, permission);
}
