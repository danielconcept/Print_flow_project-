import Link from "next/link";
import { CreateDocumentForm } from "@/components/documents/create-document-form";
import { DatabaseSetupNotice } from "@/components/database-setup-notice";
import { isSupabaseConfigured } from "@/lib/env";
import { Button } from "@/components/ui/button";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermissionPage } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewJobPage() {
  if (!isSupabaseConfigured()) {
    return <DatabaseSetupNotice moduleName="Job creation" />;
  }
  const context = await requirePermissionPage(PERMISSIONS.JOBS_MANAGE);
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("customers").select("id, name, customer_code")
    .eq("company_id", context.company.id).is("archived_at", null).order("name");
  return <div className="space-y-6">
    <header className="flex items-center justify-between"><div><h1 className="text-2xl font-semibold tracking-tight">New job</h1><p className="text-sm text-muted-foreground">Create a production job for a customer.</p></div><Button variant="outline" asChild><Link href="/jobs">Back to jobs</Link></Button></header>
    {error ? <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm">Could not load customers: {error.message}</p> : <CreateDocumentForm type="job" customers={data ?? []} />}
  </div>;
}
