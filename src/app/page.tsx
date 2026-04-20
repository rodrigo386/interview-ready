import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="max-w-2xl text-center">
        <h1 className="bg-gradient-to-r from-violet-400 to-violet-200 bg-clip-text text-5xl font-bold text-transparent sm:text-6xl">
          InterviewReady
        </h1>
        <p className="mt-6 text-xl text-zinc-400">
          Walk into every interview like you already work there.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link href="/signup">
            <Button variant="primary">Get started</Button>
          </Link>
          <Link href="/login">
            <Button variant="secondary">Sign in</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
