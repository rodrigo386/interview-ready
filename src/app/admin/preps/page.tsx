import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Preps · Admin · PrepaVAGA",
  robots: { index: false, follow: false },
};

const STATUS_BADGE: Record<string, string> = {
  complete: "bg-green-soft text-green-700 dark:bg-green-950/40 dark:text-green-300",
  generating: "bg-yellow-soft text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300",
  pending: "bg-yellow-soft text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300",
  failed: "bg-red-soft text-red-700 dark:bg-red-950/40 dark:text-red-300",
};

export default async function PrepsAdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const status = params.status ?? "";

  const sb = createAdminClient();
  let q = sb
    .from("prep_sessions")
    .select(
      "id, user_id, company_name, job_title, generation_status, ats_status, company_intel_status, cv_rewrite_status, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (status) q = q.eq("generation_status", status);
  const { data } = await q;

  const list = (data as Array<{
    id: string;
    user_id: string;
    company_name: string;
    job_title: string;
    generation_status: string;
    ats_status: string | null;
    company_intel_status: string | null;
    cv_rewrite_status: string | null;
    created_at: string;
  }> | null) ?? [];

  const userIds = [...new Set(list.map((p) => p.user_id))];
  const profiles = userIds.length
    ? await sb.from("profiles").select("id, email").in("id", userIds)
    : { data: [] };
  const emailById = new Map(
    ((profiles.data as { id: string; email: string }[] | null) ?? []).map((p) => [p.id, p.email]),
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
          Preps
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          Últimas {list.length} preps {status ? `(filtro: ${status})` : ""}.
        </p>
      </header>

      <form className="flex flex-wrap items-end gap-3" action="/admin/preps">
        <label className="flex flex-col gap-1 text-xs font-medium text-text-secondary">
          Status de geração
          <select
            name="status"
            defaultValue={status}
            className="rounded-md border border-neutral-200 bg-bg px-3 py-2 text-sm dark:border-zinc-800"
          >
            <option value="">Todos</option>
            <option value="complete">complete</option>
            <option value="generating">generating</option>
            <option value="pending">pending</option>
            <option value="failed">failed</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Filtrar
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-zinc-800">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-text-tertiary dark:bg-zinc-900/40">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">Empresa · Cargo</th>
                <th className="px-4 py-2.5 text-left font-semibold">Usuário</th>
                <th className="px-4 py-2.5 text-left font-semibold">Geração</th>
                <th className="px-4 py-2.5 text-left font-semibold">ATS</th>
                <th className="px-4 py-2.5 text-left font-semibold">Intel</th>
                <th className="px-4 py-2.5 text-left font-semibold">CV rewrite</th>
                <th className="px-4 py-2.5 text-left font-semibold">Criado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-zinc-800">
              {list.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-text-tertiary">
                    Nenhuma prep encontrada.
                  </td>
                </tr>
              ) : (
                list.map((p) => (
                  <tr key={p.id} className="bg-bg hover:bg-neutral-50/60 dark:hover:bg-zinc-900/40">
                    <td className="px-4 py-3 text-text-primary">
                      <span className="font-medium">{p.company_name}</span>{" "}
                      <span className="text-text-tertiary">·</span>{" "}
                      <span className="text-text-secondary">{p.job_title}</span>
                    </td>
                    <td className="px-4 py-3 text-text-tertiary">
                      {emailById.get(p.user_id) ?? p.user_id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={p.generation_status}>{p.generation_status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {p.ats_status ? <Badge tone={p.ats_status}>{p.ats_status}</Badge> : "-"}
                    </td>
                    <td className="px-4 py-3">
                      {p.company_intel_status ? (
                        <Badge tone={p.company_intel_status}>{p.company_intel_status}</Badge>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {p.cv_rewrite_status ? (
                        <Badge tone={p.cv_rewrite_status}>{p.cv_rewrite_status}</Badge>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-tertiary">
                      {new Date(p.created_at).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span
      className={
        "rounded-full px-2 py-0.5 text-[11px] font-semibold " +
        (STATUS_BADGE[tone] ?? "bg-neutral-100 text-text-secondary dark:bg-zinc-800")
      }
    >
      {children}
    </span>
  );
}
