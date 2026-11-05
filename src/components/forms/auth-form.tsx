"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { signIn, signUp } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthMode = "login" | "register";

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isRegister = mode === "register";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    startTransition(async () => {
      const result = isRegister ? await signUp(values) : await signIn(values);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (isRegister) {
        router.replace(
          "needsEmailConfirmation" in result.data && result.data.needsEmailConfirmation
            ? "/register/check-email"
            : "/onboarding",
        );
        router.refresh();
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    });
  }

  return (
    <form className="space-y-4 text-left" onSubmit={handleSubmit}>
      {isRegister && (
        <div className="space-y-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" name="fullName" autoComplete="name" required minLength={2} />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={isRegister ? "new-password" : "current-password"}
          required
          minLength={isRegister ? 8 : undefined}
        />
      </div>
      {isRegister && (
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
        </div>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button className="w-full" type="submit" disabled={busy}>
        {busy ? "Please wait…" : isRegister ? "Create account" : "Sign in"}
      </Button>
      <div className="flex justify-between text-sm text-muted-foreground">
        {isRegister ? (
          <Link className="underline underline-offset-4" href="/login">Already have an account? Sign in</Link>
        ) : (
          <>
            <Link className="underline underline-offset-4" href="/register">Create an account</Link>
            <Link className="underline underline-offset-4" href="/forgot-password">Forgot password?</Link>
          </>
        )}
      </div>
    </form>
  );
}
