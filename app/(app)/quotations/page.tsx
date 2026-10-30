import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/env";
import Link from "next/link";

export default async function QuotationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Quotations</h1>
          <p className="text-sm text-muted-foreground">Create and track quotes</p>
        </div>
        <Button asChild disabled={!isSupabaseConfigured()}><Link href="/quotations/new">New Quotation</Link></Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Quotation List</CardTitle>
          <CardDescription>
            {isSupabaseConfigured()
              ? "Quotes will appear here once created."
              : "Supabase not configured - UI ready for integration."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            No quotations yet
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
