import "server-only";
import { sendEmail } from "./send";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://prepavaga.com.br";
const SUPPORT_EMAIL = "prepavaga@prepavaga.com.br";

/**
 * Minimal HTML email template — no images, no fancy CSS, works in every
 * client. Goal: deliver fast and not land in spam, not look pretty.
 */
function shell({ heading, body, cta }: { heading: string; body: string; cta?: { url: string; label: string } }): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>${heading}</title></head>
<body style="margin:0;padding:24px;background:#f7f7f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1A1A1A;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px 28px;border:1px solid #E8E8E8;">
<h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#1A1A1A;">${heading}</h1>
<div style="font-size:15px;line-height:1.6;color:#4A4A4A;">${body}</div>
${
  cta
    ? `<div style="margin-top:24px;"><a href="${cta.url}" style="display:inline-block;background:#F15A24;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:999px;">${cta.label}</a></div>`
    : ""
}
<hr style="border:none;border-top:1px solid #E8E8E8;margin:32px 0 16px;">
<p style="margin:0;font-size:12px;color:#8A8A8A;">PrepaVAGA · <a href="${SITE_URL}" style="color:#8A8A8A;">prepavaga.com.br</a> · Dúvidas? <a href="mailto:${SUPPORT_EMAIL}" style="color:#8A8A8A;">${SUPPORT_EMAIL}</a></p>
</div>
</body>
</html>`;
}

export async function sendPartnerApprovedEmail(opts: {
  to: string;
  displayName: string;
  code: string;
}) {
  const link = `${SITE_URL}/?ref=${encodeURIComponent(opts.code)}`;
  const html = shell({
    heading: `${opts.displayName}, sua aplicação foi aprovada! 🎉`,
    body: `
<p>Você agora faz parte do <strong>Programa de Parceiros PrepaVAGA</strong>.</p>
<p>Seu código de afiliado: <strong style="font-family:monospace;background:#FFE7DC;padding:2px 6px;border-radius:4px;">${opts.code}</strong></p>
<p>Seu link único pra divulgar:</p>
<p style="font-family:monospace;background:#f7f7f7;padding:10px;border-radius:6px;font-size:13px;word-break:break-all;">${link}</p>
<p><strong>Como funciona daqui pra frente:</strong></p>
<ul style="padding-left:20px;">
  <li>Cada cliente que assinar Pro pelo seu link gera <strong>R$ 9 mensais</strong> de comissão pra você (30% recorrente vitalício).</li>
  <li>O Pix automático dispara quando seu saldo a receber atinge <strong>R$ 100,00</strong>.</li>
  <li>Acompanhe tudo no seu painel: indicações, MRR gerado, comissões e histórico de pagamentos.</li>
</ul>`,
    cta: { url: `${SITE_URL}/partner`, label: "Ver meu painel →" },
  });
  return sendEmail({
    to: opts.to,
    subject: "Sua aplicação de parceiro foi aprovada · PrepaVAGA",
    html,
    text: `Sua aplicação foi aprovada! Código: ${opts.code}. Link: ${link}. Painel: ${SITE_URL}/partner`,
    replyTo: SUPPORT_EMAIL,
  });
}

export async function sendPartnerRejectedEmail(opts: {
  to: string;
  displayName: string;
}) {
  const html = shell({
    heading: `${opts.displayName}, sobre sua aplicação`,
    body: `
<p>Avaliamos sua aplicação pro Programa de Parceiros PrepaVAGA e <strong>não foi possível aprová-la dessa vez</strong>.</p>
<p>Não é definitivo — se quiser entender o motivo ou tentar de novo no futuro, fala com a gente. Ou continue usando a PrepaVAGA normalmente como cliente.</p>`,
    cta: { url: `mailto:${SUPPORT_EMAIL}`, label: "Falar com o time" },
  });
  return sendEmail({
    to: opts.to,
    subject: "Sobre sua aplicação de parceiro · PrepaVAGA",
    html,
    text: `Sua aplicação não foi aprovada dessa vez. Dúvidas: ${SUPPORT_EMAIL}`,
    replyTo: SUPPORT_EMAIL,
  });
}

export async function sendPartnerPayoutSentEmail(opts: {
  to: string;
  displayName: string;
  amountCents: number;
  asaasTransferId: string;
  pixKey: string;
}) {
  const amount = (opts.amountCents / 100).toFixed(2).replace(".", ",");
  const masked = maskPixKey(opts.pixKey);
  const html = shell({
    heading: `Pagamento de R$ ${amount} enviado 💸`,
    body: `
<p>Acabamos de disparar um Pix de <strong>R$ ${amount}</strong> referente às suas comissões PrepaVAGA.</p>
<p><strong>Para:</strong> ${masked}<br>
<strong>ID da transferência:</strong> <span style="font-family:monospace;font-size:12px;">${opts.asaasTransferId}</span></p>
<p>Pagamentos via Pix instantâneo geralmente caem em segundos. Se não receber em 1h, fala com a gente.</p>`,
    cta: { url: `${SITE_URL}/partner`, label: "Ver histórico de pagamentos" },
  });
  return sendEmail({
    to: opts.to,
    subject: `Pix de R$ ${amount} enviado · PrepaVAGA Parceiros`,
    html,
    text: `Pix de R$ ${amount} enviado pra ${masked}. ID: ${opts.asaasTransferId}. Histórico: ${SITE_URL}/partner`,
    replyTo: SUPPORT_EMAIL,
  });
}

function maskPixKey(key: string): string {
  if (key.includes("@")) {
    const [user, domain] = key.split("@");
    if (!user || !domain) return key;
    return `${user.slice(0, 2)}***@${domain}`;
  }
  // CPF / phone / random: show first 3 and last 2 chars
  const digits = key.replace(/\D/g, "");
  if (digits.length >= 6) {
    return `${digits.slice(0, 3)}***${digits.slice(-2)}`;
  }
  return key.slice(0, 2) + "***";
}
