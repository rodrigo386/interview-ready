/**
 * Uma linha de confiança colada ao botão que manda para o Asaas.
 *
 * Existe por causa de um abandono real: em 14/09 a usuária mais engajada que o
 * site já teve (duas análises da mesma vaga, reescreveu o próprio título)
 * clicou em pagar, chegou à tela do Asaas e saiu sem escolher PIX nem cartão.
 * Não dá pra saber o motivo com uma pessoa só, mas o que ela via era uma tela
 * de pagamento de outra marca, sem nenhum aviso antes de chegar lá.
 *
 * A garantia de 7 dias já estava nos termos de uso. O problema era que ela não
 * aparecia no único momento em que importa: o clique.
 */
export function PagamentoSeguro({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs leading-5 text-ink-3 ${className}`}>
      <span aria-hidden>🔒</span> Pagamento seguro pelo <strong>Asaas</strong> · PIX ou
      cartão · <strong>reembolso em 7 dias</strong> se não gostar · sem assinatura
    </p>
  );
}
