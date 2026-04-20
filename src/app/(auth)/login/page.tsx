import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";
// TODO(Task 11): import { GoogleButton } from "@/components/auth/GoogleButton";

function OAuthErrorBanner({ error }: { error?: string }) {
  if (error !== "oauth_failed") return null;
  return (
    <p className="rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
      Google sign-in failed. Please try again.
    </p>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-semibold">Sign in</h1>
        <p className="mt-2 text-center text-sm text-zinc-400">
          New here?{" "}
          <Link href="/signup" className="text-brand hover:underline">
            Create an account
          </Link>
        </p>
        <div className="mt-8 space-y-6">
          <OAuthErrorBanner error={params.error} />
          <LoginForm />
          {/* TODO(Task 11): OR divider + <GoogleButton label="Sign in with Google" /> */}
        </div>
      </div>
    </main>
  );
}
