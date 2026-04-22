import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import { AtsScoreBadge } from "@/components/prep/AtsScoreBadge";

type SessionRow = {
  id: string;
  company_name: string;
  job_title: string;
  generation_status: string;
  created_at: string;
  ats_status: string | null;
  ats_score: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  complete: "bg-emerald-950/40 text-emerald-300 border-emerald-900",
  generating: "bg-amber-950/40 text-amber-300 border-amber-900",
  pending: "bg-amber-950/40 text-amber-300 border-amber-900",
  failed: "bg-red-950/40 text-red-300 border-red-900",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: sessions } = await supabase
    .from("prep_sessions")
    .select(
      "id, company_name, job_title, generation_status, created_at, ats_status, ats_score:ats_analysis->>score",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const list: SessionRow[] = sessions ?? [];

  if (list.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="rounded-full bg-zinc-900 p-4 text-4xl">✨</div>
        <h1 className="mt-6 text-2xl font-semibold">Create your first prep</h1>
        <p className="mt-2 max-w-md text-sm text-zinc-400">
          Upload your CV and paste a job description — we&apos;ll generate
          a personalized interview playbook in about 30 seconds.
        </p>
        <Link href="/prep/new" className="mt-8">
          <Button>New prep</Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your preps</h1>
        <Link href="/prep/new">
          <Button>New prep</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {list.map((s) => (
          <Link
            key={s.id}
            href={`/prep/${s.id}`}
            className="block rounded-lg border border-zinc-800 bg-zinc-900/40 p-5 transition-colors hover:bg-zinc-900"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="truncate text-base font-medium">{s.company_name}</h2>
                <p className="mt-1 truncate text-sm text-zinc-400">{s.job_title}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_STYLE[s.generation_status] ?? ""}`}
                >
                  {s.generation_status}
                </span>
                {s.ats_status === "complete" && atsScoreFromRow(s) !== null && (
                  <AtsScoreBadge score={atsScoreFromRow(s) as number} />
                )}
              </div>
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              {new Date(s.created_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function atsScoreFromRow(row: SessionRow): number | null {
  if (row.ats_score == null) return null;
  const n = Number(row.ats_score);
  return Number.isFinite(n) ? n : null;
}
