import "server-only";
import type { PostSummary } from "./posts";

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

  return scored.slice(0, n).map((s) => s.post);
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
