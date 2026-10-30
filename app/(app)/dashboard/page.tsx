import { isSupabaseConfigured } from "@/lib/env";
import { getSessionContext } from "@/lib/supabase/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let companyName = "Not configured";
  let role = "—";
  let currency = "NGN";
  let metrics = { customers: 0, jobs: 0, invoices: 0, outstanding: 0 };
  let dataAvailable = false;
  if (isSupabaseConfigured()) {
    try {
      const context = await getSessionContext();
      companyName = context.company?.name ?? "No workspace";
      role = context.membership?.role ?? "—";
      currency = context.company?.currency ?? currency;
      if (context.company) {
        const supabase = await createServerSupabaseClient();
        const [customersResult, jobsResult, invoicesResult] = await Promise.all([
          supabase.from("customers").select("id", { count: "exact", head: true }).eq("company_id", context.company.id).is("archived_at", null),
          supabase.from("job_orders").select("id", { count: "exact", head: true }).eq("company_id", context.company.id),
          supabase.from("invoices").select("total_minor, amount_paid_minor, status").eq("company_id", context.company.id),
        ]);
        metrics = {
          customers: customersResult.count ?? 0,
          jobs: jobsResult.count ?? 0,
          invoices: invoicesResult.data?.length ?? 0,
          outstanding: (invoicesResult.data ?? []).reduce(
            (sum, invoice) => sum + (invoice.status === "void" ? 0 : Math.max(0, invoice.total_minor - invoice.amount_paid_minor)),
            0,
          ),
        };
        dataAvailable = !customersResult.error && !jobsResult.error && !invoicesResult.error;
      }
    } catch {
      companyName = "Not configured";
      role = "—";
    }
  }
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              {companyName} • {role}
            </p>
          </div>
          <Badge variant={isSupabaseConfigured() ? "default" : "secondary"}>
            {isSupabaseConfigured() ? "Connected" : "Not configured"}
          </Badge>
        </div>
      </header>

      {!dataAvailable && isSupabaseConfigured() && (
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">Set up a workspace to see live business metrics.</CardContent></Card>
      )}
      {!isSupabaseConfigured() && (
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">Add your Supabase URL and anon key in .env.local to enable live data.</CardContent></Card>
      )}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Customers", value: metrics.customers.toLocaleString(), detail: "Active records" },
          { label: "Jobs", value: metrics.jobs.toLocaleString(), detail: "All production jobs" },
          { label: "Invoices", value: metrics.invoices.toLocaleString(), detail: "All invoices" },
          { label: "Outstanding", value: new Intl.NumberFormat("en", { style: "currency", currency }).format(metrics.outstanding / 100), detail: "Unpaid balance" },
        ].map((metric) => (
          <Card key={metric.label}>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{metric.label}</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{dataAvailable ? metric.value : "—"}</div><p className="text-xs text-muted-foreground">{metric.detail}</p></CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
