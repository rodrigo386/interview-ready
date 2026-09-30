const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Caminho de volta pós-pagamento. O Asaas devolve a pessoa pra
 * `/dashboard?billing=ok&prep=<id>`; o dashboard reconcilia o pagamento e só
 * então redireciona pra prep. Só aceita UUID e monta o caminho a partir dele:
 * nunca ecoa uma URL vinda da query (open redirect).
 */
export function prepReturnPath(id: unknown): string | null {
  return typeof id === "string" && UUID.test(id) ? `/prep/${id}` : null;
}

export function isPrepId(id: unknown): id is string {
  return prepReturnPath(id) !== null;
}
