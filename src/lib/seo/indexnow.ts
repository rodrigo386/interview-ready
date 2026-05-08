import "server-only";

/**
 * IndexNow ping — fire-and-forget protocol that tells Bing/Yandex/Seznam to
 * recrawl URLs immediately. Bing typically picks up changes within hours
 * (vs days/weeks for unsolicited crawl). Free, no API key beyond the public
 * domain-verification token below.
 *
 * Setup:
 * - Public key file lives at /public/<KEY>.txt and must contain just the key
 * - keyLocation in the POST body points to that public URL
 * - Same key is hardcoded here (it is NOT a secret — it is the proof of
 *   domain ownership, served publicly)
 */

export const INDEXNOW_KEY = "6983ac3ceb813d6db7d354bd4662ec38";
const SITE_HOST = "prepavaga.com.br";
const SITE_URL = `https://${SITE_HOST}`;
const KEY_LOCATION = `${SITE_URL}/${INDEXNOW_KEY}.txt`;

export type IndexNowResult = {
  ok: boolean;
  status: number;
  submitted: number;
  detail?: string;
};

/**
 * Submit a batch of URLs to IndexNow. Endpoint accepts up to 10,000 URLs
 * per request. Returns 200 on accept, 202 on accepted-but-pending validation,
 * 422 on bad URL/key mismatch, 429 on rate limit.
 */
export async function submitToIndexNow(
  urls: string[],
): Promise<IndexNowResult> {
  if (urls.length === 0) {
    return { ok: true, status: 0, submitted: 0, detail: "no urls" };
  }

  // Filter out anything that doesn't look like our domain — IndexNow requires
  // every URL to share the host of the key file.
  const cleanUrls = urls.filter((u) => u.startsWith(SITE_URL));
  if (cleanUrls.length === 0) {
    return {
      ok: false,
      status: 0,
      submitted: 0,
      detail: "no urls match site host",
    };
  }

  try {
    const res = await fetch("https://api.indexnow.org/IndexNow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: SITE_HOST,
        key: INDEXNOW_KEY,
        keyLocation: KEY_LOCATION,
        urlList: cleanUrls,
      }),
    });
    const ok = res.status >= 200 && res.status < 300;
    return {
      ok,
      status: res.status,
      submitted: cleanUrls.length,
      detail: ok ? undefined : await res.text().catch(() => undefined),
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      submitted: 0,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}
