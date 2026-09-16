/**
 * Layout HTML comum dos e-mails transacionais (sem imagem, estilos inline).
 * Extraído do reengagement-email quando o e-mail de recuperação de checkout
 * passou a precisar do mesmo visual.
 *
 * ATENÇÃO: `heading` e `body` entram como HTML cru. Qualquer dado vindo de
 * usuário ou de IA (nome, cargo, empresa, palavras-chave) tem que passar por
 * `escapeHtml` antes — cargo e empresa são texto colado por qualquer pessoa.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://prepavaga.com.br";
export const SUPPORT_EMAIL = "prepavaga@prepavaga.com.br";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Minimal, image-free HTML shell — mirrors the other transactional emails. */
export function emailShell({
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
