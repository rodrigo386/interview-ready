import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NewPrepForm } from "@/components/prep/NewPrepForm";

export default async function NewPrepPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: cvs } = await supabase
    .from("cvs")
    .select("id, file_name, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8">
        <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-zinc-100">
          ← Back to dashboard
        </Link>
      </div>

      <h1 className="text-3xl font-semibold">Create a prep guide</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Upload your CV and paste the job description. Takes about 30 seconds.
      </p>

      <div className="mt-10">
        <NewPrepForm existingCvs={cvs ?? []} />
      </div>
    </main>
  );
}
