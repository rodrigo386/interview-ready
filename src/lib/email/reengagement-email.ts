import "server-only";
import { sendEmail } from "./send";
import { emailShell as shell, SITE_URL, SUPPORT_EMAIL } from "./layout";

function firstName(name?: string | null): string {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";
  return first.length > 1 ? first : "";
}

/**
 * One-off re-engagement nudge for dormant users who created an account but
 * never ran an ATS analysis. Low-pressure, acknowledges the free analysis is
 * still waiting. Sent from the /admin "Reengajar dormentes" button (guarded by
 * reengagement_email_sent_at so nobody gets it twice). Graceful without
 * RESEND_API_KEY (no-op).
 */
export async function sendReengagementEmail(opts: { to: string; name?: string | null }) {
  const hi = firstName(opts.name);
  const heading = hi
    ? `${hi}, sua análise ATS grátis ainda está te esperando`
    : "Sua análise ATS grátis ainda está te esperando";

  const html = shell({
    heading,
    body: `
<p>Você criou uma conta na PrepaVAGA mas ainda não testou sua análise ATS — e ela continua <strong>grátis</strong>, te esperando.</p>
<p>Em menos de 1 minuto, a partir do link de uma vaga + seu CV, você vê a nota do seu currículo e os pontos críticos que mais pesam. Sem pagar nada.</p>
<p>Se quiser ir além, a preparação completa (pesquisa da empresa, perguntas prováveis em 3 níveis e CV otimizado pra baixar) custa R$10.</p>
<p>É só ter o link (ou texto) da vaga e o seu CV em mãos.</p>`,
    cta: { url: `${SITE_URL}/analise-ats-gratis`, label: "Analisar meu currículo grátis →" },
  });

  return sendEmail({
    to: opts.to,
    subject: "Sua análise ATS grátis na PrepaVAGA ainda está disponível",
    html,
    text: `Você criou uma conta na PrepaVAGA mas ainda não testou sua análise ATS grátis. Veja agora em ${SITE_URL}/analise-ats-gratis — basta o link da vaga e o seu CV. A preparação completa custa R$10.`,
    replyTo: SUPPORT_EMAIL,
  });
}
