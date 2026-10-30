import Link from "next/link";

export default function CheckEmailPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
        <p className="text-sm text-muted-foreground">
          If an account can be created for that address, we’ll send a confirmation link. Follow it to continue to workspace setup. If no email arrives, try signing in or resetting your password.
        </p>
        <Link className="inline-block text-sm underline underline-offset-4" href="/login">
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
