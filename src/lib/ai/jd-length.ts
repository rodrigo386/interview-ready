/**
 * Abaixo disso a régua do ATS (as palavras que a vaga pede) fica com uma ou
 * duas entradas e a nota deixa de significar "compatibilidade". Caso real
 * (2026-09-30): vaga de uma linha, "gerente geral de supermercado", e um
 * gerente com 28 anos na própria rede tirou 7/100.
 */
export const MIN_JD_WORDS = 60;

export function jdWordCount(jd: string | null | undefined): number {
  const t = (jd ?? "").trim();
  return t ? t.split(/\s+/).length : 0;
}

export function isJdTooShort(jd: string | null | undefined): boolean {
  return jdWordCount(jd) < MIN_JD_WORDS;
}
