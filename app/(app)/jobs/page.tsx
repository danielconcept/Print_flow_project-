import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DatabaseSetupNotice } from "@/components/database-setup-notice";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/env";
import Link from "next/link";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermissionPage } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function JobsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
          <p className="text-sm text-muted-foreground">Production workflow and status tracking</p>
        </header>
        <DatabaseSetupNotice moduleName="Job management" />
      </div>
    );
  }

  const context = await requirePermissionPage(PERMISSIONS.JOBS_VIEW);
  const supabase = await createServerSupabaseClient();
  const { data: jobs, error } = await supabase.from("job_orders")
    .select("id, job_number, title, status, priority, due_date")
    .eq("company_id", context.company.id).order("created_at", { ascending: false });
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
          <p className="text-sm text-muted-foreground">Production workflow and status tracking</p>
        </div>
        <Button asChild disabled={!isSupabaseConfigured()}><Link href="/jobs/new">New Job</Link></Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Job Board</CardTitle>
          <CardDescription>
            {isSupabaseConfigured()
              ? "Jobs will appear here with status tracking."
              : "Supabase not configured - UI ready for integration."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? <p role="alert" className="text-sm text-destructive">Could not load jobs: {error.message}</p> : jobs?.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-3">Job</th><th className="p-3">Status</th><th className="p-3">Priority</th><th className="p-3">Due date</th></tr></thead><tbody>{jobs.map((job) => <tr key={job.id} className="border-b"><td className="p-3"><div className="font-medium">{job.title}</div><div className="text-xs text-muted-foreground">{job.job_number}</div></td><td className="p-3">{job.status.replaceAll("_", " ")}</td><td className="p-3">{job.priority}</td><td className="p-3">{job.due_date ?? "—"}</td></tr>)}</tbody></table></div> : <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">No jobs yet</div>}
        </CardContent>
      </Card>
    </div>
  );
}
