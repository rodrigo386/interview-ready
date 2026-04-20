import { Button } from "@/components/ui/Button";

export default function DashboardPage() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="rounded-full bg-zinc-900 p-4 text-4xl">✨</div>
      <h1 className="mt-6 text-2xl font-semibold">Create your first prep</h1>
      <p className="mt-2 max-w-md text-sm text-zinc-400">
        Upload your CV and paste a job description — we&apos;ll research the
        company, analyze the role, and build your interview playbook.
      </p>
      <Button disabled className="mt-8">
        New prep (coming soon)
      </Button>
    </div>
  );
}
