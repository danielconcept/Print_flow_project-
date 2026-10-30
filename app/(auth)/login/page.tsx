import { AuthForm } from "@/components/forms/auth-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to PrintFlow</h1>
        <p className="text-sm text-muted-foreground">Sign in to manage your print business.</p>
        <AuthForm mode="login" />
      </div>
    </main>
  );
}
