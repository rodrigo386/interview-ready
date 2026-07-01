import "server-only";
import { sendEmail } from "./send";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://prepavaga.com.br";
const SUPPORT_EMAIL = "prepavaga@prepavaga.com.br";

/** First name only, for a friendlier greeting. Empty string when unusable. */
function firstName(name?: string | null): string {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";
  return first.length > 1 ? first : "";
}

/**
 * Welcome / first-prep nudge, sent once on first dashboard load. Targets the
 * activation gap: users who sign up and confirm but never start a prep. Keeps a
 * single strong CTA to /prep/new. Graceful: without RESEND_API_KEY, sendEmail
 * logs a warn and no-ops.
 */
export async function sendWelcomeEmail(opts: { to: string; name?: string | null }) {
  const hi = firstName(opts.name);
  const heading = hi
    ? `${hi}, sua primeira preparação é grátis 🎯`
    : "Sua primeira preparação é grátis 🎯";

  const html = shell({
    heading,
    body: `
<p>Boas-vindas à PrepaVAGA! Sua conta está pronta e você tem <strong>uma preparação completa grátis</strong> (vitalícia).</p>
<p>A partir do link de uma vaga + seu CV, em cerca de 60 segundos você recebe:</p>
<ul style="padding-left:20px;">
  <li><strong>Análise ATS</strong> do seu currículo contra a vaga, com os pontos críticos.</li>
  <li><strong>Pesquisa atualizada da empresa</strong> e perguntas prováveis em 3 níveis.</li>
  <li>Um <strong>CV otimizado</strong> pronto pra baixar.</li>
</ul>
<p>Tenha em mãos o <strong>link (ou texto) da vaga</strong> e o <strong>seu CV</strong>. Leva 2 minutos.</p>`,
    cta: { url: `${SITE_URL}/prep/new`, label: "Criar minha preparação grátis →" },
  });

  return sendEmail({
    to: opts.to,
    subject: "Bem-vindo à PrepaVAGA — sua 1ª preparação é grátis",
    html,
    text: `Boas-vindas à PrepaVAGA! Sua primeira preparação é grátis e vitalícia. Crie agora em ${SITE_URL}/prep/new — basta o link da vaga e o seu CV.`,
    replyTo: SUPPORT_EMAIL,
  });
}

/** Minimal, image-free HTML shell — mirrors the partner-emails template. */
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
