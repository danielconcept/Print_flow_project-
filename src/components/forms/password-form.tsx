"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { sendPasswordReset, updatePassword } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswordForm({ mode }: { mode: "forgot" | "reset" }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    startTransition(async () => {
      const result = mode === "forgot" ? await sendPasswordReset(values) : await updatePassword(values);
      if (!result.ok) {
        setError(result.error);
      } else if (mode === "forgot") {
        setMessage("If an account exists for that email, a password reset link has been sent.");
      } else {
        router.replace("/login?passwordUpdated=1");
        router.refresh();
      }
    });
  }

  return (
    <form className="space-y-4 text-left" onSubmit={handleSubmit}>
      {mode === "forgot" ? (
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required />
          </div>
        </>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {message && <p role="status" className="text-sm text-green-700">{message}</p>}
      <Button className="w-full" type="submit" disabled={busy}>
        {busy ? "Please wait…" : mode === "forgot" ? "Send reset link" : "Update password"}
      </Button>
      <Link className="block text-center text-sm underline underline-offset-4" href="/login">Return to sign in</Link>
    </form>
  );
}
