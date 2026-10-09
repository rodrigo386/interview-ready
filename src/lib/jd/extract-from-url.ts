import "server-only";
import { cleanJobDescription } from "@/lib/ai/gemini";

/**
 * Busca a página de uma vaga e devolve o texto limpo. Compartilhado pela busca
 * do usuário logado (`prep/new/jd-actions`) e pela do visitante anônimo
 * (`analise-ats-gratis/jd-actions`).
 *
 * Usa o Jina Reader (https://r.jina.ai): serviço gratuito que renderiza páginas
 * com JavaScript e devolve markdown, sem chave. A limpeza com Gemini tira banner
 * de cookie, menu e rodapé.
 *
 * O Jina é IRREGULAR, e isso foi medido (2026-10-09, vagas reais): Catho e
 * Vagas.com (vaga ativa) trazem a descrição; a Gupy trouxe a vaga completa em 4
 * de 6 (uma só com o bloco de benefícios, outra quase vazia); um link do
 * LinkedIn redirecionou pra uma página de lista. Por isso o texto extraído
 * NUNCA vai direto pra análise: a pessoa revisa no campo antes de enviar, e a
 * mensagem de erro sempre oferece colar o texto.
 */

export type Motivo =
  | "url_invalida"
  | "limite"
  | "rede"
  | "http"
  | "pouco_texto"
  | "nao_parece_vaga"
  | "erro";

export type ExtractResult =
  | { ok: true; text: string }
  | { ok: false; motivo: Motivo; error: string };

export const MAX_TEXT_CHARS = 50_000;
export const MIN_TEXT_CHARS = 200;
const FETCH_TIMEOUT_MS = 20_000;

/**
 * Palavras que uma descrição de vaga quase sempre tem e uma página de
 * benefícios, de lista ou de erro quase nunca tem. Duas distintas bastam: uma só
 * aparece em qualquer texto institucional ("experiência" num blog, "perfil").
 * Cobre PT e EN porque a análise aceita vagas nos dois idiomas.
 */
const SINAIS_DE_VAGA = [
  "requisitos",
  "responsabilidades",
  "atividades",
  "atribuicoes",
  "qualificacoes",
  "conhecimentos",
  "experiencia em",
  "experiencia com",
  "formacao",
  "escolaridade",
  "diferenciais",
  "buscamos",
  "procuramos",
  "o que voce vai",
  "requirements",
  "responsibilities",
  "qualifications",
  "you will",
  "skills",
];

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Esta página parece trazer a descrição de uma vaga? Existe pra duas coisas: não
 * mandar pra análise (e pra uma prep paga) um texto que é só o bloco de
 * benefícios da empresa, que foi o que a Gupy devolveu pra uma das vagas
 * testadas; e dificultar o uso do endpoint anônimo como proxy de páginas
 * quaisquer.
 */
export function pareceDescricaoDeVaga(texto: string): boolean {
  const t = semAcento(texto);
  let achados = 0;
  for (const s of SINAIS_DE_VAGA) {
    if (t.includes(s)) achados++;
    if (achados >= 2) return true;
  }
  return false;
}

/**
 * Só http(s) de um site de verdade: sem localhost, sem IP e sem host interno.
 * Quem busca a página é o Jina, não o nosso servidor, então não é defesa de SSRF
 * contra a nossa infra — é barrar o uso sem sentido (e o abuso barato) antes de
 * gastar uma chamada.
 */
export function urlDeVagaValida(raw: string): { ok: true; url: string } | { ok: false } {
  const s = raw.trim();
  if (s.length === 0 || s.length > 2000) return { ok: false };
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return { ok: false };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false };
  const host = u.hostname.toLowerCase();
  if (!host.includes(".")) return { ok: false }; // "localhost", "intranet"
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) return { ok: false }; // IPv4/IPv6
  if (/\.(local|internal|localhost|lan)$/.test(host)) return { ok: false };
  return { ok: true, url: u.toString() };
}

export async function extractJdFromUrl(
  url: string,
  opts: { exigirSinaisDeVaga?: boolean } = {},
): Promise<ExtractResult> {
  let res: Response;
  try {
    res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: "text/plain", "User-Agent": "PrepaVaga/1.0" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    console.error("[extractJdFromUrl] network error:", err);
    return {
      ok: false,
      motivo: "rede",
      error:
        "Não consegui acessar essa página (timeout ou rede). Cole o texto da vaga em vez disso.",
    };
  }

  if (!res.ok) {
    return {
      ok: false,
      motivo: "http",
      error: `Não consegui ler essa página (HTTP ${res.status}). Pode ser uma página com login. Cole o texto da vaga em vez disso.`,
    };
  }

  const raw = (await res.text()).trim();
  // Jina Reader returns markdown with a small header; strip front matter.
  const stripped = raw
    .replace(/^Title:.*\nURL Source:.*\n(Markdown Content:.*?\n)?/im, "")
    .trim();

  if (stripped.length < MIN_TEXT_CHARS) {
    return {
      ok: false,
      motivo: "pouco_texto",
      error:
        "A página não tem texto suficiente para gerar um prep. Cole o texto da vaga em vez disso.",
    };
  }

  // Best-effort AI cleanup: strip cookie banners, navigation, legal footer.
  // Failures fall back to the raw text inside cleanJobDescription itself.
  const cleaned = await cleanJobDescription(stripped);

  if (cleaned.length < MIN_TEXT_CHARS) {
    return {
      ok: false,
      motivo: "pouco_texto",
      error:
        "Depois de limpar a página, sobrou pouco conteúdo. Cole o texto da vaga em vez disso.",
    };
  }

  if (opts.exigirSinaisDeVaga && !pareceDescricaoDeVaga(cleaned)) {
    return {
      ok: false,
      motivo: "nao_parece_vaga",
      error:
        "Essa página não parece trazer a descrição da vaga (alguns portais escondem o texto). Copie o texto da vaga e cole no campo.",
    };
  }

  return { ok: true, text: cleaned.slice(0, MAX_TEXT_CHARS) };
}
