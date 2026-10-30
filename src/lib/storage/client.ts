import { createClient } from "@/lib/supabase/client";

export async function uploadArtwork(file: File, companyId: string, jobId: string) {
  const supabase = createClient();
  const path = `${companyId}/${jobId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
  const { error } = await supabase.storage.from("artwork").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function uploadReceipt(file: File, companyId: string) {
  const supabase = createClient();
  const path = `${companyId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
  const { error } = await supabase.storage.from("receipts").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function createSignedUrl(bucket: string, path: string, expiresIn = 3600) {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
