import { CustomerManager } from "@/components/customers/customer-manager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/env";
import { PERMISSIONS } from "@/lib/permissions";
import { can, requirePermissionPage } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">Manage customer records and history</p>
        </header>
        <Card>
          <CardHeader>
            <CardTitle>Database connection required</CardTitle>
            <CardDescription>Customer records are tenant-scoped and require a configured Supabase project.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Copy .env.example to .env.local and set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.</p>
            <p>Apply the SQL migrations in supabase/migrations, then restart the development server.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const context = await requirePermissionPage(PERMISSIONS.CUSTOMERS_VIEW);
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, customer_code, name, phone, email, address, notes, created_at")
    .eq("company_id", context.company.id)
    .is("archived_at", null)
    .order("name", { ascending: true });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
        <p className="text-sm text-muted-foreground">Manage customer records and history</p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Customer list</CardTitle>
          <CardDescription>Search and maintain the customers in your workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <CustomerManager
            customers={data ?? []}
            canManage={can(context, PERMISSIONS.CUSTOMERS_MANAGE)}
            loadError={error?.message}
          />
        </CardContent>
      </Card>
    </div>
  );
}
