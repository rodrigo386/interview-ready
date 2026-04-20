import Link from "next/link";
import { SignupForm } from "@/components/auth/SignupForm";
import { GoogleButton } from "@/components/auth/GoogleButton";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-semibold">Create your account</h1>
        <p className="mt-2 text-center text-sm text-zinc-400">
          Already have one?{" "}
          <Link href="/login" className="text-brand hover:underline">
            Sign in
          </Link>
        </p>
        <div className="mt-8 space-y-6">
          <SignupForm />
          <div className="flex items-center gap-3">
            <hr className="flex-1 border-zinc-800" />
            <span className="text-xs text-zinc-500">OR</span>
            <hr className="flex-1 border-zinc-800" />
          </div>
          <GoogleButton label="Sign up with Google" />
        </div>
      </div>
    </main>
  );
}
