import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function DatabaseSetupNotice({ moduleName }: { moduleName: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Database connection required</CardTitle>
        <CardDescription>
          {moduleName} data is stored in your Supabase workspace. Connect the database to continue.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>Copy <code>.env.example</code> to <code>.env.local</code> and set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.</p>
        <p>Apply the SQL migrations in <code>supabase/migrations</code>, then restart the development server.</p>
      </CardContent>
    </Card>
  );
}
