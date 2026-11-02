import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { getSessionContext } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (!isSupabaseConfigured()) {
    redirect("/dashboard");
  }

  const context = await getSessionContext();
  if (!context.user.id) {
    redirect("/login");
  }
  if (!context.company) {
    redirect("/onboarding");
  }
  redirect("/dashboard");
}
