"use server";

import { redirect } from "next/navigation";
import {
  forgotPasswordSchema,
  loginSchema,
  onboardingSchema,
  registerSchema,
  updatePasswordSchema,
} from "@/lib/domain/schemas";
import { AppError } from "@/lib/errors";
import { getAppUrl } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { withAction } from "@/lib/server/actions";
import type { ActionResult } from "@/lib/errors";

export async function signIn(input: unknown): Promise<ActionResult<{ ok: true }>> {
  return withAction(async () => {
    const supabase = await createServerSupabaseClient();
    const parsed = loginSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError("INVALID", "Invalid login details.", parsed.error.message, 400);
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (error) throw error;
    return { ok: true };
  });
}

export async function signUp(input: unknown): Promise<ActionResult<{ needsEmailConfirmation: boolean }>> {
  return withAction(async () => {
    const supabase = await createServerSupabaseClient();
    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError("INVALID", "Invalid registration details.", parsed.error.message, 400);
    }

    const callbackUrl = new URL("/auth/callback", getAppUrl());
    callbackUrl.searchParams.set("next", "/onboarding");

    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: callbackUrl.toString(),
        data: {
          full_name: parsed.data.fullName,
        },
      },
    });
    if (error) throw error;
    return { needsEmailConfirmation: !data.session };
  });
}

export async function signOut(): Promise<ActionResult<{ ok: true }>> {
  return withAction(async () => {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { ok: true };
  });
}

export async function sendPasswordReset(input: unknown): Promise<ActionResult<{ ok: true }>> {
  return withAction(async () => {
    const parsed = forgotPasswordSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError("INVALID", "Enter a valid email address.", "Enter a valid email address.", 400);
    }
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${getAppUrl()}/auth/callback?next=/reset-password`,
    });
    if (error) throw error;
    return { ok: true };
  });
}

export async function updatePassword(input: unknown): Promise<ActionResult<{ ok: true }>> {
  return withAction(async () => {
    const parsed = updatePasswordSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError("INVALID", "Check the password fields.", "Check the password fields.", 400);
    }
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) throw error;
    return { ok: true };
  });
}

export async function createWorkspace(input: unknown): Promise<ActionResult<{ companyId: string }>> {
  return withAction(async () => {
    const supabase = await createServerSupabaseClient();
    const parsed = onboardingSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError("INVALID", "Invalid workspace details.", parsed.error.message, 400);
    }

    const { data, error } = await supabase.rpc("create_company", {
      p_name: parsed.data.companyName,
      p_slug: parsed.data.slug,
      p_full_name: parsed.data.fullName,
    } as any);
    if (error) throw error;
    return { companyId: data as string };
  });
}

export async function acceptInvitation(token: string): Promise<ActionResult<{ companyId: string }>> {
  return withAction(async () => {
    const supabase = await createServerSupabaseClient();
    if (!token) {
      throw new AppError("INVALID", "Invitation token is required.", "Invitation token is required.", 400);
    }

    const { data, error } = await supabase.rpc("accept_invitation", {
      p_token_hash: token,
    } as any);
    if (error) throw error;
    return { companyId: data as string };
  });
}

export async function goToDashboard() {
  redirect("/dashboard");
}
