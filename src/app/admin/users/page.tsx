import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { DeleteUserButton } from "@/components/admin/DeleteUserButton";
import { GrantProButton } from "@/components/admin/GrantProButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Usuários · Admin · PrepaVAGA",
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 50;

export default async function UsersAdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; tier?: string; page?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const q = (params.q ?? "").trim();
  const tier = params.tier ?? "";
  const page = Math.max(1, Number(params.page ?? "1") || 1);

  const sb = createAdminClient();
  let query = sb
    .from("profiles")
    .select(
      "id, email, full_name, tier, subscription_status, prep_credits, preps_used_this_month, is_admin, created_at, asaas_customer_id, asaas_subscription_id",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (q) query = query.ilike("email", `%${q}%`);
  if (tier === "free") query = query.eq("tier", "free");
  if (tier === "pro") query = query.eq("tier", "pro");

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data, count } = await query.range(from, to);

  const users = (data as Array<{
    id: string;
    email: string;
    full_name: string | null;
    tier: string;
    subscription_status: string | null;
    prep_credits: number;
    preps_used_this_month: number;
    is_admin: boolean;
    created_at: string;
    asaas_customer_id: string | null;
    asaas_subscription_id: string | null;
  }> | null) ?? [];

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
          Usuários
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          {total.toLocaleString("pt-BR")} usuário{total === 1 ? "" : "s"} no sistema.
        </p>
      </header>

      <form className="flex flex-wrap items-end gap-3" action="/admin/users">
        <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-text-secondary">
          Buscar por e-mail
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="email@example.com"
            className="rounded-md border border-neutral-200 bg-bg px-3 py-2 text-sm text-text-primary dark:border-zinc-800"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-text-secondary">
          Plano
          <select
            name="tier"
            defaultValue={tier}
            className="rounded-md border border-neutral-200 bg-bg px-3 py-2 text-sm dark:border-zinc-800"
          >
            <option value="">Todos</option>
            <option value="free">Free</option>
            <option value="pro">Pro</option>
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
                <th className="px-4 py-2.5 text-left font-semibold">E-mail</th>
                <th className="px-4 py-2.5 text-left font-semibold">Nome</th>
                <th className="px-4 py-2.5 text-left font-semibold">Plano</th>
                <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                <th className="px-4 py-2.5 text-left font-semibold">Preps</th>
                <th className="px-4 py-2.5 text-left font-semibold">Créditos</th>
                <th className="px-4 py-2.5 text-left font-semibold">Cadastro</th>
                <th className="px-4 py-2.5 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-zinc-800">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-text-tertiary">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="bg-bg hover:bg-neutral-50/60 dark:hover:bg-zinc-900/40">
                    <td className="px-4 py-3 align-top">
                      <span className="flex items-center gap-2 text-text-primary">
                        {u.email}
                        {u.is_admin && (
                          <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-brand-700 dark:bg-brand-900/30 dark:text-brand-500">
                            admin
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top text-text-secondary">
                      {u.full_name ?? "-"}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span
                        className={
                          "rounded-full px-2 py-0.5 text-[11px] font-semibold " +
                          (u.tier === "pro"
                            ? "bg-green-soft text-green-700 dark:bg-green-950/40 dark:text-green-300"
                            : "bg-neutral-100 text-text-secondary dark:bg-zinc-800")
                        }
                      >
                        {u.tier}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top text-text-tertiary">
                      {u.subscription_status ?? "-"}
                    </td>
                    <td className="px-4 py-3 align-top text-text-secondary">
                      {u.preps_used_this_month}
                    </td>
                    <td className="px-4 py-3 align-top text-text-secondary">
                      {u.prep_credits}
                    </td>
                    <td className="px-4 py-3 align-top text-text-tertiary">
                      {new Date(u.created_at).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        year: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <div className="flex justify-end gap-1.5">
                        <GrantProButton
                          userId={u.id}
                          email={u.email}
                          tier={u.tier}
                          isAdmin={u.is_admin}
                          hasAsaasSubscription={Boolean(u.asaas_subscription_id)}
                        />
                        <DeleteUserButton
                          userId={u.id}
                          email={u.email}
                          disabled={u.is_admin}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <nav className="flex items-center justify-between text-sm text-text-secondary">
          <span>
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={buildPageUrl({ q, tier, page: page - 1 })}
                className="rounded-md border border-neutral-200 px-3 py-1.5 hover:text-text-primary dark:border-zinc-800"
              >
                ← Anterior
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={buildPageUrl({ q, tier, page: page + 1 })}
                className="rounded-md border border-neutral-200 px-3 py-1.5 hover:text-text-primary dark:border-zinc-800"
              >
                Próxima →
              </Link>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}

function buildPageUrl({ q, tier, page }: { q: string; tier: string; page: number }): string {
  const sp = new URLSearchParams();
  if (q) sp.set("q", q);
  if (tier) sp.set("tier", tier);
  sp.set("page", String(page));
  return `/admin/users?${sp.toString()}`;
}
