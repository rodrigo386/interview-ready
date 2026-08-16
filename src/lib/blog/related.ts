import "server-only";
import type { PostSummary } from "./posts";

/**
 * Two deliberately different questions — collapsing them into one predicate
 * broke the bridge below, because a curiosity article tagged "currículo"
 * counted as ATS cluster and satisfied the guard on its own.
 *
 * isResumeTopicPost — "is the reader thinking about their CV?" Drives CTA
 * message match, so it stays broad (gap no currículo, foto no currículo).
 *
 * isAtsClusterPost — "is this one of the ATS articles we want to funnel
 * traffic into?" Narrow on purpose: the slug must carry `ats` as its own
 * segment, or the post must be tagged exactly `ats`.
 */
const RESUME_TOPIC = /ats|curr[íi]culo/i;
const ATS_SLUG_SEGMENT = /(^|-)ats(-|$)/;

export function isResumeTopicPost(post: {
  slug: string;
  tags?: string[];
}): boolean {
  return (
    RESUME_TOPIC.test(post.slug) ||
    (post.tags ?? []).some((t) => RESUME_TOPIC.test(t))
  );
}

export function isAtsClusterPost(post: {
  slug: string;
  tags?: string[];
}): boolean {
  return (
    ATS_SLUG_SEGMENT.test(post.slug) ||
    (post.tags ?? []).some((t) => t.trim().toLowerCase() === "ats")
  );
}

export function pickRelatedPosts(
  current: { slug: string; tags?: string[] },
  all: PostSummary[],
  n = 3,
): PostSummary[] {
  const others = all.filter((p) => p.slug !== current.slug);
  const currentTags = new Set(current.tags ?? []);

  const scored = others.map((p) => {
    const overlap = (p.tags ?? []).filter((t) => currentTags.has(t)).length;
    return { post: p, score: overlap };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (
      new Date(b.post.publishedAt).getTime() -
      new Date(a.post.publishedAt).getTime()
    );
  });

  const ranked = scored.map((s) => s.post);
  const picked = ranked.slice(0, n);

  // Tag overlap alone keeps the high-traffic "curiosity" articles (processo
  // seletivo, follow-up de recrutador) pointing only at each other, so the
  // reader never reaches the ATS pages that match what we sell. Reserve the
  // weakest slot for one product-cluster post. Ordering of the stronger slots
  // is untouched, and nothing is forced when no such post exists.
  if (!isAtsClusterPost(current) && !picked.some(isAtsClusterPost)) {
    const bridge = ranked.find(isAtsClusterPost);
    if (bridge && picked.length > 0) picked[picked.length - 1] = bridge;
  }

  return picked;
}

export function extractH2Headings(markdown: string): string[] {
  const lines = markdown.split(/\r?\n/);
  let inFence = false;
  const headings: string[] = [];
  for (const line of lines) {
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^##\s+(.+?)\s*$/.exec(line);
    if (match) headings.push(match[1].trim());
  }
  return headings;
}
