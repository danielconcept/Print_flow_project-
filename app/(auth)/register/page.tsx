import { AuthForm } from "@/components/forms/auth-form";

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Create an account</h1>
        <p className="text-sm text-muted-foreground">Create an account to set up your workspace.</p>
        <AuthForm mode="register" />
      </div>
    </main>
  );
}
