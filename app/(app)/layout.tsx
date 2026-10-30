import { isSupabaseConfigured } from "@/lib/env";
import { getSessionContext } from "@/lib/supabase/auth";
import { AppShell } from "@/components/layout/app-shell";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured()) {
    return <AppShell>{children}</AppShell>;
  }
  const context = await getSessionContext();
  if (!context.user.id) redirect("/login");
  return <AppShell companyName={context.company?.name}>{children}</AppShell>;
}
