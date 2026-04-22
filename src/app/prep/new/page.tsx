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
        <Link
          href="/dashboard"
          className="text-sm text-text-secondary hover:text-text-primary"
        >
          ← Voltar para seus preps
        </Link>
      </div>

      <h1 className="text-3xl font-semibold tracking-tight text-text-primary">
        Novo prep
      </h1>
      <p className="mt-2 text-sm text-text-secondary">
        Envie seu CV e a descrição da vaga. Seu dossiê fica pronto em cerca de 60 segundos.
      </p>

      <div className="mt-10">
        <NewPrepForm existingCvs={cvs ?? []} />
      </div>
    </main>
  );
}
