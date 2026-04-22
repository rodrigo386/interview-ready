import Link from "next/link";
import type { SidebarItemStatus } from "./PrepSidebar";

type StatusLine = {
  label: string;
  status: SidebarItemStatus;
  hint?: string;
};

export function PrepOverview({
  sessionId,
  company,
  role,
  estimatedMinutes,
  sectionsReady,
  sectionsTotal,
  intelStatus,
  atsStatus,
  atsScore,
  rewriteStatus,
  firstSectionId,
}: {
  sessionId: string;
  company: string;
  role: string;
  estimatedMinutes: number;
  sectionsReady: number;
  sectionsTotal: number;
  intelStatus: SidebarItemStatus | "unavailable";
  atsStatus: SidebarItemStatus;
  atsScore: number | null;
  rewriteStatus: SidebarItemStatus;
  firstSectionId: string | null;
}) {
  const statusLines: StatusLine[] = [
    {
      label: "Guia de perguntas",
      status: sectionsReady > 0 ? "ready" : "pending",
      hint:
        sectionsTotal > 0
          ? `${sectionsReady} de ${sectionsTotal} seções prontas`
          : "Aguardando geração",
    },
  ];

  if (intelStatus !== "unavailable") {
    statusLines.push({
      label: "Sobre a empresa",
      status: intelStatus,
      hint: hintFor(intelStatus),
    });
  }

  statusLines.push({
    label: "Compatibilidade ATS",
    status: atsStatus,
    hint:
      atsStatus === "ready" && atsScore !== null
        ? `Nota ${atsScore}/100`
        : hintFor(atsStatus),
  });

  statusLines.push({
    label: "CV otimizado para ATS",
    status: rewriteStatus,
    hint: hintFor(rewriteStatus),
  });

  const startHere: Array<{
    title: string;
    body: string;
    href: string;
    disabled?: boolean;
  }> = [];

  if (intelStatus === "ready") {
    startHere.push({
      title: "1. Conheça a empresa",
      body: "Leia a pesquisa que montamos: notícias recentes, estrutura do negócio e fatos que você pode citar.",
      href: `/prep/${sessionId}?section=company-intel`,
    });
  }

  startHere.push({
    title: `${startHere.length + 1}. Cheque seu ATS`,
    body:
      atsStatus === "ready"
        ? "Veja seu score e os ajustes prioritários no seu CV."
        : "Rode a análise para descobrir as lacunas entre seu CV e a vaga.",
    href: `/prep/${sessionId}?section=ats`,
  });

  if (firstSectionId) {
    startHere.push({
      title: `${startHere.length + 1}. Estude as perguntas prováveis`,
      body: "Key points, resposta modelo e dicas para cada pergunta — organize sua história.",
      href: `/prep/${sessionId}?section=${firstSectionId}`,
    });
  }

  return (
    <div className="space-y-10">
      <header>
        <p className="text-sm uppercase tracking-wide text-text-tertiary">
          Prep para
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-text-primary">
          <span className="text-brand-600">{company}</span>
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          {role} · tempo estimado: {estimatedMinutes} min
        </p>
      </header>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-tertiary">
          Status do seu prep
        </h2>
        <ul className="mt-4 divide-y divide-border rounded-lg border border-border bg-surface">
          {statusLines.map((line) => (
            <li
              key={line.label}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <StatusDot status={line.status} />
                <span className="text-sm text-text-primary">{line.label}</span>
              </div>
              {line.hint && (
                <span className="text-xs text-text-secondary">{line.hint}</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-tertiary">
          Comece por aqui
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {startHere.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="rounded-lg border border-border bg-surface p-5 transition-colors hover:border-brand-600 hover:bg-surface-muted"
            >
              <p className="text-sm font-semibold text-text-primary">
                {item.title}
              </p>
              <p className="mt-2 text-sm text-text-secondary">{item.body}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface-muted/40 p-5 text-sm text-text-secondary">
        <p className="font-semibold text-text-primary">Como usar este prep</p>
        <p className="mt-2">
          Use o menu à esquerda para navegar. Cada seção tem um propósito: a
          pesquisa da empresa te dá contexto, o ATS valida seu CV e as seções
          de perguntas te preparam para a conversa.
        </p>
      </section>
    </div>
  );
}

function StatusDot({ status }: { status: SidebarItemStatus }) {
  const cls = {
    ready: "bg-emerald-500",
    generating: "bg-blue-500 animate-pulse",
    failed: "bg-red-500",
    pending: "bg-zinc-500/50",
  }[status];
  return <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${cls}`} />;
}

function hintFor(status: SidebarItemStatus): string {
  switch (status) {
    case "ready":
      return "Pronto";
    case "generating":
      return "Gerando…";
    case "failed":
      return "Falhou — tente novamente";
    case "pending":
      return "Ainda não rodou";
  }
}
