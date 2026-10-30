import "server-only";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/errors";
import { toActionError } from "@/lib/errors";

export async function withAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (error) {
    return toActionError(error);
  }
}

export async function revalidateAppPaths(paths: string[]) {
  for (const path of paths) {
    revalidatePath(path);
  }
}

export function requireServerContext() {
  if (typeof window !== "undefined") {
    throw new Error("Server-only function called on the client.");
  }
}
