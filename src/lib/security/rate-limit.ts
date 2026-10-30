import { createServiceSupabaseClient } from "@/lib/supabase/service";

export async function consumeRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  try {
    const supabase = createServiceSupabaseClient();
    const { data, error } = await supabase.rpc("consume_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    } as any);
    if (error) return false;
    return Boolean(data);
  } catch {
    return false;
  }
}

export function getClientKey(request: Request, prefix: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  return `${prefix}:${ip}`;
}
