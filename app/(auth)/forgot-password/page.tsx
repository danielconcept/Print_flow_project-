import { PasswordForm } from "@/components/forms/password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
        <p className="text-sm text-muted-foreground">We’ll email you a secure password reset link.</p>
        <PasswordForm mode="forgot" />
      </div>
    </main>
  );
}
