import { isSupabaseConfigured } from "@/lib/env";
import { getSessionContext } from "@/lib/supabase/auth";
import { redirect } from "next/navigation";
import { WorkspaceForm } from "@/components/forms/workspace-form";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  if (!isSupabaseConfigured()) {
    redirect("/dashboard");
  }
  const context = await getSessionContext();
  if (!context.user.id) redirect("/login");
  if (context.company) redirect("/dashboard");
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Set up your workspace</h1>
        <p className="text-sm text-muted-foreground">Create a company workspace to begin managing customers, jobs, and invoices.</p>
        <WorkspaceForm fullName={context.profile?.fullName ?? ""} />
      </div>
    </main>
  );
}
