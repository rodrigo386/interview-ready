import "server-only";
import { sendEmail } from "./send";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://prepavaga.com.br";
const SUPPORT_EMAIL = "prepavaga@prepavaga.com.br";

function firstName(name?: string | null): string {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";
  return first.length > 1 ? first : "";
}

/**
 * One-off re-engagement nudge for dormant free users who created an account but
 * never generated a prep. Low-pressure, acknowledges the free prep is still
 * waiting. Sent from the /admin "Reengajar dormentes" button (guarded by
 * reengagement_email_sent_at so nobody gets it twice). Graceful without
 * RESEND_API_KEY (no-op).
 */
export async function sendReengagementEmail(opts: { to: string; name?: string | null }) {
  const hi = firstName(opts.name);
  const heading = hi
    ? `${hi}, sua preparação grátis ainda está te esperando`
    : "Sua preparação grátis ainda está te esperando";

  const html = shell({
    heading,
    body: `
<p>Você criou uma conta na PrepaVAGA mas ainda não gerou sua preparação — e ela continua <strong>grátis</strong>, te esperando.</p>
<p>Em cerca de 60 segundos, a partir do link de uma vaga + seu CV, você recebe:</p>
<ul style="padding-left:20px;">
  <li><strong>Análise ATS</strong> do seu currículo contra a vaga, com os pontos críticos.</li>
  <li><strong>Pesquisa atualizada da empresa</strong> e perguntas prováveis em 3 níveis.</li>
  <li>Um <strong>CV otimizado</strong> pronto pra baixar.</li>
</ul>
<p>Leva 2 minutos e pode fazer diferença na sua próxima entrevista. É só ter o link (ou texto) da vaga e o seu CV em mãos.</p>`,
    cta: { url: `${SITE_URL}/prep/new`, label: "Gerar minha preparação grátis →" },
  });

  return sendEmail({
    to: opts.to,
    subject: "Sua preparação grátis na PrepaVAGA ainda está disponível",
    html,
    text: `Você criou uma conta na PrepaVAGA mas ainda não gerou sua preparação grátis. Crie agora em ${SITE_URL}/prep/new — basta o link da vaga e o seu CV.`,
    replyTo: SUPPORT_EMAIL,
  });
}

/** Minimal, image-free HTML shell — mirrors the other transactional emails. */
function shell({
  heading,
  body,
  cta,
}: {
  heading: string;
  body: string;
  cta?: { url: string; label: string };
}): string {
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
