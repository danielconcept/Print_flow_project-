import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/env";

export default async function InvoicesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground">Billing and payment tracking</p>
        </div>
        <Button disabled={!isSupabaseConfigured()}>New Invoice</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Invoice List</CardTitle>
          <CardDescription>
            {isSupabaseConfigured()
              ? "Invoices and balances will appear here."
              : "Supabase not configured - UI ready for integration."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            No invoices yet
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
