"use client";

import { useActionState, useState, useTransition } from "react";
import { runAnonAtsAnalysis } from "@/app/analise-ats-gratis/actions";
import { fetchJdFromUrlAnon } from "@/app/analise-ats-gratis/jd-actions";
import { PendingButton } from "@/components/prep/PendingButton";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/anon-ats/core";
import { track } from "@/lib/analytics/client";

/**
 * `page` é o formulário de /analise-ats-gratis, onde a página inteira é dele.
 * `hero` é o mesmo formulário embutido acima da dobra da landing: campos mais
 * baixos e textos auxiliares mais curtos, porque ali ele divide a primeira tela
 * com a headline e precisa mostrar o primeiro campo sem rolagem.
 *
 * Os ids dos campos levam sufixo por variante: nada impede as duas variantes de
 * coexistirem num futuro layout, e id duplicado quebra a associação label/input
 * (o segundo <label htmlFor> passa a apontar pro campo da outra instância).
 */
type Variant = "page" | "hero";

export function AnonAtsForm({ variant = "page" }: { variant?: Variant } = {}) {
  const [state, action] = useActionState(runAnonAtsAnalysis, null);
  const hero = variant === "hero";
  const id = (base: string) => (hero ? `${base}-hero` : base);
  // Validação de tamanho no cliente. Sem ela, um arquivo acima do
  // `bodySizeLimit` faz a server action estourar antes de rodar — sem
  // `state.error`, sem redirect, sem nada na tela.
  const [fileError, setFileError] = useState<string | null>(null);
  // O <input type="file"> nativo desenha o próprio botão com o texto do
  // sistema operacional ("Choose File / No file chosen"), em inglês, no meio
  // de uma página em português. Não há CSS que troque esse texto, então o
  // input fica visualmente escondido (mas presente e associado ao label, pra
  // teclado e leitor de tela) e o nome do arquivo é renderizado por nós.
  const [fileName, setFileName] = useState<string | null>(null);

  // A vaga pode entrar por texto colado OU por link. O texto do link NÃO vai
  // direto pra análise: volta pro mesmo campo, onde a pessoa confere antes de
  // enviar (o Jina Reader é irregular — Catho e Vagas.com ok, Gupy parcial,
  // LinkedIn não — e uma vaga errada gasta a única análise grátis da pessoa).
  const [vaga, setVaga] = useState("");
  const [modo, setModo] = useState<"texto" | "link">("texto");
  const [link, setLink] = useState("");
  const [erroLink, setErroLink] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [importado, setImportado] = useState(false);
  const [buscando, iniciarBusca] = useTransition();

  function buscar() {
    if (!link.trim() || buscando) return;
    setErroLink(null);
    setAviso(null);
    const hostTentado = hostDe(link);
    iniciarBusca(async () => {
      const r = await fetchJdFromUrlAnon(link);
      track(
        "jd_link_fetch",
        r.ok
          ? { ok: true, host: r.host }
          : { ok: false, motivo: r.motivo, ...(hostTentado ? { host: hostTentado } : {}) },
      );
      if (!r.ok) {
        setErroLink(r.error);
        return;
      }
      setVaga(r.text);
      setImportado(true);
      setModo("texto");
      setAviso(`Importamos o texto de ${r.host}. Confira se é a vaga certa antes de analisar.`);
    });
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setFileError(null);
      setFileName(null);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      // O arquivo grande demais é DESCARTADO do formulário (única forma de
      // limpar um <input type="file"> é zerar o value). Antes ele ficava
      // selecionado e o botão de enviar era desabilitado — mas colar o texto
      // não reabilitava nada e o usuário não tem como desselecionar um
      // arquivo, então a segunda metade da instrução ("ou cole o texto") não
      // funcionava e o botão ficava morto sem saída. Descartando, o envio
      // segue possível pelo texto colado e o formulário nunca manda um body
      // que estouraria o limite da server action.
      e.target.value = "";
      setFileName(null);
      setFileError(
        `Este arquivo tem ${mb} MB e o limite é ${MAX_UPLOAD_LABEL}. Ele não foi anexado — escolha um arquivo menor ou cole o texto do currículo abaixo.`,
      );
      return;
    }
    setFileError(null);
    setFileName(file.name);
  }

  const erro = fileError ?? state?.error ?? null;

  return (
    <form
      action={(fd) => {
        // No modo link o campo de texto fica escondido (e sem `required`):
        // quem aperta "Analisar" sem ter buscado a vaga recebe o aviso aqui,
        // em vez de um erro genérico do servidor.
        if (!vaga.trim()) {
          setModo("link");
          setErroLink("Busque a vaga pelo link ou cole o texto dela.");
          return;
        }
        const arquivo = fd.get("cvFile");
        track("anon_ats_started", {
          cv_source:
            arquivo instanceof File && arquivo.size > 0 ? "file" : "paste",
          placement: variant,
          jd_source: importado ? "link" : "paste",
        });
        action(fd);
      }}
      className={hero ? "space-y-4" : "space-y-6"}
    >
      <div>
        <label htmlFor={id("jobDescription")} className="text-sm font-bold text-ink">
          1. Cole a descrição da vaga
        </label>

        {/* Um indicador só desliza entre as duas opções (mesma mola do Gauge e
            do seletor do /prep/new). */}
        <div
          role="tablist"
          aria-label="Como enviar a vaga"
          className="relative mt-2 grid grid-cols-2 gap-2 rounded-xl border border-line bg-surface p-1"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.5rem)] rounded-lg bg-orange-500 shadow-sm transition-transform duration-[450ms] ease-[var(--ease-spring)]"
            style={{
              transform:
                modo === "texto" ? "translateX(0)" : "translateX(calc(100% + 0.5rem))",
            }}
          />
          {(
            [
              ["texto", "Colar texto"],
              ["link", "Colar link da vaga"],
            ] as const
          ).map(([m, rotulo]) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={modo === m}
              onClick={() => setModo(m)}
              className={
                "relative z-10 rounded-lg px-3 py-2 text-sm transition-colors duration-[450ms] ease-out " +
                (modo === m ? "font-semibold text-white" : "font-medium text-ink-2 hover:text-ink")
              }
            >
              {rotulo}
            </button>
          ))}
        </div>

        {modo === "link" ? (
          <div className="mt-3 space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="url"
                inputMode="url"
                aria-label="Link da vaga"
                value={link}
                disabled={buscando}
                onChange={(e) => setLink(e.target.value)}
                onKeyDown={(e) => {
                  // Enter aqui NÃO pode enviar o formulário (seria disparar a
                  // análise com o campo da vaga vazio): ele busca a vaga.
                  if (e.key === "Enter") {
                    e.preventDefault();
                    buscar();
                  }
                }}
                placeholder="https://empresa.com/vagas/analista"
                className="min-w-0 flex-1 rounded-lg border border-line p-3 text-[15px] text-ink disabled:opacity-60"
              />
              <button
                type="button"
                onClick={buscar}
                disabled={buscando || !link.trim()}
                className="shrink-0 rounded-lg border border-border-strong bg-bg px-4 py-3 text-sm font-semibold text-ink transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                {buscando ? "Buscando…" : "Buscar vaga"}
              </button>
            </div>
            <p className="text-xs text-ink-3">
              Cole o link da vaga no site da empresa ou de um portal (Gupy, Catho,
              Vagas.com…). Páginas com login, como o LinkedIn, costumam não abrir:
              nesse caso copie o texto da vaga.
            </p>
            {erroLink ? (
              <p role="alert" className="rounded-lg bg-red-soft px-4 py-3 text-sm text-red-500">
                {erroLink}
              </p>
            ) : null}
          </div>
        ) : null}

        <textarea
          id={id("jobDescription")}
          name="jobDescription"
          rows={hero ? 4 : 8}
          required={modo === "texto"}
          hidden={modo === "link"}
          value={vaga}
          onChange={(e) => setVaga(e.target.value)}
          placeholder="Cole aqui o texto completo da vaga que você quer disputar."
          className="mt-3 w-full rounded-lg border border-line p-3 text-[15px] text-ink"
        />
        {aviso && modo === "texto" ? (
          <p role="status" className="mt-2 text-xs text-green-700">
            {aviso}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor={id("cvFile")} className="text-sm font-bold text-ink">
          2. Envie seu currículo
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {/* input e label precisam ser irmãos diretos: o `peer-focus-visible`
              do Tailwind é um seletor de irmão, e o anel de foco é a única
              pista visual que sobra pra quem navega por teclado. */}
          <input
            id={id("cvFile")}
            name="cvFile"
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={onFileChange}
            className="peer sr-only"
          />
          <label
            htmlFor={id("cvFile")}
            className="cursor-pointer rounded-md border border-border-strong bg-bg px-3 py-2 text-sm font-semibold text-ink transition hover:bg-surface-muted peer-focus-visible:ring-2 peer-focus-visible:ring-brand-600 peer-focus-visible:ring-offset-2"
          >
            Escolher arquivo
          </label>
          <span className="min-w-0 flex-1 truncate text-sm text-ink-2">
            {fileName ?? "Nenhum arquivo escolhido"}
          </span>
        </div>
        <p className="mt-2 text-xs text-ink-3">
          {hero
            ? `PDF, DOCX ou TXT, até ${MAX_UPLOAD_LABEL}. Guardamos só o texto extraído, por 7 dias.`
            : `PDF, DOCX ou TXT, até ${MAX_UPLOAD_LABEL}. Não guardamos o arquivo, só o texto extraído, que fica guardado por 7 dias e depois deixa de ser acessível.`}
        </p>
        <details className={hero ? "mt-2" : "mt-3"}>
          <summary className="cursor-pointer text-sm text-orange-700">
            Prefiro colar o texto
          </summary>
          <label
            htmlFor={id("cvText")}
            className="mt-3 block text-sm font-bold text-ink"
          >
            Cole o texto do seu currículo
          </label>
          <textarea
            id={id("cvText")}
            name="cvText"
            rows={hero ? 5 : 8}
            placeholder="Cole aqui o conteúdo do seu currículo."
            // Colar o texto é a alternativa que a mensagem de arquivo grande
            // demais oferece: assim que ela é usada, o aviso sobre o arquivo
            // descartado deixa de fazer sentido e sai da frente de um
            // eventual erro do servidor.
            onChange={(e) => {
              if (e.target.value.trim()) setFileError(null);
            }}
            className="mt-2 w-full rounded-lg border border-line p-3 text-[15px] text-ink"
          />
        </details>
      </div>

      {erro ? (
        <p role="alert" className="rounded-lg bg-red-soft px-4 py-3 text-sm text-red-500">
          {erro}
        </p>
      ) : null}

      <PendingButton
        idleLabel="Analisar meu currículo grátis →"
        pendingLabel="Analisando…"
        variant="primary"
        size={hero ? "lg" : "md"}
        className={hero ? "w-full" : undefined}
      />
      <p className="text-xs text-ink-3">
        Sem cadastro e sem cartão. Você vê seu score na hora.
      </p>
    </form>
  );
}

/** Só o domínio (sem caminho nem parâmetros) pro evento de analytics. */
function hostDe(raw: string): string | undefined {
  try {
    return new URL(raw.trim()).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}
