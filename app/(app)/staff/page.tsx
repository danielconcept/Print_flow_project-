import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/env";

export default async function StaffPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Staff</h1>
          <p className="text-sm text-muted-foreground">Team members and permissions</p>
        </div>
        <Button disabled={!isSupabaseConfigured()}>Invite Staff</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Team</CardTitle>
          <CardDescription>
            {isSupabaseConfigured()
              ? "Staff and invitations will appear here."
              : "Supabase not configured - UI ready for integration."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            No staff yet
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
