import Link from "next/link";
import { CreateDocumentForm } from "@/components/documents/create-document-form";
import { Button } from "@/components/ui/button";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermissionPage } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewQuotationPage() {
  const context = await requirePermissionPage(PERMISSIONS.QUOTATIONS_MANAGE);
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("customers").select("id, name, customer_code")
    .eq("company_id", context.company.id).is("archived_at", null).order("name");
  return <div className="space-y-6">
    <header className="flex items-center justify-between"><div><h1 className="text-2xl font-semibold tracking-tight">New quotation</h1><p className="text-sm text-muted-foreground">Prepare a quotation for a customer.</p></div><Button variant="outline" asChild><Link href="/quotations">Back to quotations</Link></Button></header>
    {error ? <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm">Could not load customers: {error.message}</p> : <CreateDocumentForm type="quotation" customers={data ?? []} defaultTerms={context.company.settings.quotation_terms} />}
  </div>;
}
