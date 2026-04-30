import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://prepavaga.com.br";

const PRIVATE_PATHS = [
  "/api/",
  "/api/test/",
  "/auth/",
  "/admin",
  "/admin/",
  "/dashboard",
  "/profile",
  "/profile/",
  "/prep/",
  "/welcome/",
  "/forgot-password",
  "/reset",
];

const AI_BOTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "Bytespider",
  "Meta-ExternalAgent",
  "FacebookBot",
  "CCBot",
  "Amazonbot",
  "cohere-ai",
  "DuckAssistBot",
  "MistralAI-User",
];

export default function robots(): MetadataRoute.Robots {
  const aiBotRules = AI_BOTS.map((userAgent) => ({
    userAgent,
    allow: "/",
    disallow: PRIVATE_PATHS,
  }));

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
      ...aiBotRules,
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
