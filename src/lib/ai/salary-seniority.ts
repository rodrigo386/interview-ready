const CANON = [
  "estagio",
  "junior",
  "pleno",
  "senior",
  "especialista",
  "lideranca",
  "nao_identificado",
] as const;

const SINONIMOS: Record<string, (typeof CANON)[number]> = {
  estagiario: "estagio",
  trainee: "estagio",
  jr: "junior",
  sr: "senior",
  lider: "lideranca",
  gerente: "lideranca",
  gestor: "lideranca",
  gerencia: "lideranca",
  coordenador: "lideranca",
  diretor: "lideranca",
};

/**
 * O modelo devolve a senioridade com acento ("sênior", "liderança") ou com
 * sinônimo, e o enum do schema só aceita a forma canônica. Antes, isso
 * derrubava o benchmark INTEIRO por causa de uma palavra: faixa, mediana e
 * notas válidas eram jogadas fora e o cliente pagante ficava sem o entregável.
 * Valor irreconhecível cai em `nao_identificado` em vez de reprovar a resposta.
 */
export function normalizeSeniority(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  const s = raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");
  if ((CANON as readonly string[]).includes(s)) return s;
  return SINONIMOS[s] ?? "nao_identificado";
}
