import { PasswordForm } from "@/components/forms/password-form";

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="text-sm text-muted-foreground">Choose a new password for your account.</p>
        <PasswordForm mode="reset" />
      </div>
    </main>
  );
}
