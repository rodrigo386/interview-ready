import type { CompanyIntel } from "@/lib/ai/schemas";

export type SectionKind =
  | "likely"
  | "deep-dive"
  | "tricky"
  | "questions-to-ask"
  | "mindset";

type SectionBrief = {
  id: string;
  title: string;
  icon: string;
  focus: string;
  num_cards: number;
};

const SECTION_BRIEFS: Record<SectionKind, SectionBrief> = {
  likely: {
    id: "likely-questions",
    title: "Perguntas prováveis",
    icon: "💬",
    focus:
      "Perguntas comportamentais e de fit que o entrevistador provavelmente vai abrir. Pense em motivação, pontos fortes, conquistas e um ângulo de 'me fala sobre você'.",
    num_cards: 3,
  },
  "deep-dive": {
    id: "deep-dive-questions",
    title: "Perguntas de aprofundamento",
    icon: "🔍",
    focus:
      "Perguntas técnicas e de domínio ligadas às responsabilidades da vaga. Exemplos: como abordaria os primeiros 90 dias, projetos complexos que liderou, frameworks de decisão que usa.",
    num_cards: 3,
  },
  "questions-to-ask": {
    id: "questions-to-ask",
    title: "Perguntas pra fazer ao entrevistador",
    icon: "❓",
    focus:
      "Perguntas estratégicas que o candidato deve fazer e que sinalizam pesquisa e julgamento. O campo 'question' de cada card é a pergunta do candidato; 'sample_answer' é o coaching sobre POR QUE perguntar isso e que sinal escutar.",
    num_cards: 3,
  },
  tricky: {
    id: "tricky-questions",
    title: "Perguntas difíceis",
    icon: "🎯",
    focus:
      "Perguntas difíceis, inesperadas ou de stress-test. Exemplos: por que está saindo da empresa atual, o que faria diferente da pessoa anterior nessa vaga, fraqueza com mitigação real, perguntas-curveball estilo 'venda essa caneta', como lidaria com má notícia ou pushback. Cada card precisa parecer realista e ancorado nas áreas de risco do CV do candidato.",
    num_cards: 3,
  },
  mindset: {
    id: "mindset-tips",
    title: "Mentalidade e dicas",
    icon: "🧠",
    focus:
      "Framing, soft skills e dicas de delivery específicas pra esse candidato e essa vaga. Exemplos: como enquadrar o valor dele vs. candidatos mais baratos, ritmo de uma entrevista de 45 minutos, o que enfatizar vs. minimizar dado o CV, dicas de setup de videocall, como se recuperar de uma derrapada no meio da entrevista. O 'question' de cada card é uma situação/tópico, 'sample_answer' é o coaching que ele precisa.",
    num_cards: 3,
  },
};

export function buildSectionPrompt(params: {
  kind: SectionKind;
  cvText: string;
  jdText: string;
  jobTitle: string;
  companyName: string;
  companyIntel?: CompanyIntel | null;
}) {
  const brief = SECTION_BRIEFS[params.kind];
  const intelBlock = params.companyIntel
    ? renderIntelBlock(params.companyIntel)
    : "";

  const intelGuidance = params.companyIntel
    ? `\n\nSe a INTELIGÊNCIA DA EMPRESA estiver disponível, costure fatos específicos (nomes, datas, apostas estratégicas) em pelo menos 2 dos seus sample_answers. Não invente fatos além do que foi fornecido.`
    : "";

  const system = `Você é um coach de entrevista de elite gerando UMA seção do guia de prep para um candidato específico aplicando pra uma vaga específica.

**RESPONDA EM PORTUGUÊS BRASILEIRO.** Todo o conteúdo das perguntas, key_points, sample_answers, tips e summary deve estar em PT-BR — mesmo que o CV ou a descrição da vaga estejam em inglês.

Foco da seção: ${brief.focus}

Você DEVE retornar exatamente ${brief.num_cards} cards.

Regras por card:
- question: a pergunta provável de entrevista (ou, pra "Perguntas pra fazer ao entrevistador", a pergunta que o candidato deve fazer)
- key_points: 3-4 bullets, cada um ≤ 15 palavras, que o candidato cobre na resposta
- sample_answer: 3-4 frases (60-100 palavras) de uma resposta natural e conversacional, usando detalhes ESPECÍFICOS do CV do candidato — nomes de empresas, métricas, títulos de projetos
- tips: UMA frase (≤ 25 palavras) de dica de delivery
- confidence_level: "high" se o CV sustenta fortemente a resposta, "medium" se parcial, "low" se fraco
- references_cv: 1-3 itens concretos do CV em que a resposta se baseia (empresa + ano + iniciativa)

NUNCA dê conselho genérico. SEMPRE referencie a experiência específica do candidato.${intelGuidance}

Use estes valores fixos pra seção:
- id: "${brief.id}"
- title: "${brief.title}"
- icon: "${brief.icon}"
- summary: uma frase (≤ 20 palavras) descrevendo o que essa seção cobre

Retorne agora a seção completa.`;

  const user = `CV DO CANDIDATO:
${params.cvText}

DESCRIÇÃO DA VAGA-ALVO:
${params.jdText}

CARGO-ALVO: ${params.jobTitle}
EMPRESA-ALVO: ${params.companyName}${intelBlock}`;

  return { system, user, brief };
}

function renderIntelBlock(intel: CompanyIntel): string {
  const devs = intel.recent_developments
    .map((d) => `- ${d.headline}: ${d.why_it_matters}`)
    .join("\n");
  const people = intel.key_people
    .map((p) => `- ${p.name} (${p.role}): ${p.background_snippet}`)
    .join("\n");
  const culture = intel.culture_signals.join(", ");
  return `

INTELIGÊNCIA DA EMPRESA (use estes fatos específicos nas suas respostas):

Visão geral: ${intel.overview}

Desenvolvimentos recentes:
${devs || "(nenhum)"}

Pessoas-chave:
${people || "(nenhuma)"}

Sinais de cultura: ${culture || "(nenhum)"}

Contexto estratégico: ${intel.strategic_context}`;
}

export const SECTION_KINDS: SectionKind[] = [
  "likely",
  "deep-dive",
  "tricky",
  "questions-to-ask",
  "mindset",
];
