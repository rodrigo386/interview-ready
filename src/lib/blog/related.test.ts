import { describe, it, expect } from "vitest";
import {
  pickRelatedPosts,
  isAtsClusterPost,
  isResumeTopicPost,
} from "./related";
import type { PostSummary } from "./posts";

const post = (
  slug: string,
  tags: string[],
  publishedAt = "2026-05-01",
): PostSummary => ({
  slug,
  tags,
  publishedAt,
  title: slug,
  description: `sobre ${slug}`,
  readingMinutes: 5,
});

// Curiosity cluster: high traffic, no commercial intent.
const curiosity = [
  post("quanto-tempo-demora-processo-seletivo", ["processo seletivo", "recrutamento"]),
  post("recrutador-nao-respondeu-o-que-fazer", ["processo seletivo", "follow-up"]),
  post("por-que-rh-nao-chamou-de-volta", ["processo seletivo", "recrutador", "currículo"]),
  post("como-saber-se-vaga-e-fake", ["processo seletivo"]),
];

// Product cluster: aligned with the ATS feature.
const productCluster = [
  post("curriculo-de-rh-ats", ["currículo", "ats"]),
  post("como-reescrever-curriculo-para-ats", ["currículo", "ats"]),
];

describe("isAtsClusterPost", () => {
  it("recognises the ATS cluster by slug", () => {
    expect(isAtsClusterPost({ slug: "curriculo-de-rh-ats" })).toBe(true);
    expect(isAtsClusterPost({ slug: "o-que-e-ats" })).toBe(true);
    expect(isAtsClusterPost({ slug: "curriculo-para-ats-guia-completo" })).toBe(
      true,
    );
  });

  it("recognises the ATS cluster by tag", () => {
    expect(isAtsClusterPost({ slug: "guia-generico", tags: ["ats"] })).toBe(
      true,
    );
  });

  it("does not claim a curiosity post", () => {
    expect(
      isAtsClusterPost({
        slug: "quanto-tempo-demora-processo-seletivo",
        tags: ["processo seletivo"],
      }),
    ).toBe(false);
  });

  // Regression: this post is a curiosity article that happens to carry the
  // "currículo" tag. Treating it as ATS cluster silently suppressed the
  // bridge on both high-traffic pages.
  it("does not claim a curiosity post merely tagged currículo", () => {
    expect(
      isAtsClusterPost({
        slug: "por-que-rh-nao-chamou-de-volta",
        tags: ["processo seletivo", "recrutador", "currículo", "entrevista"],
      }),
    ).toBe(false);
  });
});

describe("isResumeTopicPost", () => {
  it("stays broad — drives CTA message match, not the bridge", () => {
    expect(isResumeTopicPost({ slug: "como-explicar-gap-no-curriculo" })).toBe(
      true,
    );
    expect(
      isResumeTopicPost({ slug: "foto-no-curriculo-brasil-2026" }),
    ).toBe(true);
    expect(isResumeTopicPost({ slug: "curriculo-de-rh-ats" })).toBe(true);
  });

  it("excludes posts with no resume angle", () => {
    expect(
      isResumeTopicPost({
        slug: "como-negociar-oferta-de-emprego",
        tags: ["entrevista"],
      }),
    ).toBe(false);
  });
});

describe("pickRelatedPosts", () => {
  it("bridges a curiosity post to the product cluster", () => {
    const all = [...curiosity, ...productCluster];
    const related = pickRelatedPosts(curiosity[0], all, 3);

    expect(related).toHaveLength(3);
    expect(related.some((p) => isAtsClusterPost(p))).toBe(true);
  });

  it("never includes the current post", () => {
    const all = [...curiosity, ...productCluster];
    const related = pickRelatedPosts(curiosity[0], all, 3);

    expect(related.map((p) => p.slug)).not.toContain(curiosity[0].slug);
  });

  it("still ranks tag overlap first for the non-bridge slots", () => {
    const all = [...curiosity, ...productCluster];
    const related = pickRelatedPosts(curiosity[0], all, 3);

    // recrutador + por-que-rh share "processo seletivo" with the current post
    expect(related[0].tags).toContain("processo seletivo");
  });

  it("leaves an ATS post's own related list tag-driven", () => {
    const all = [...curiosity, ...productCluster];
    const related = pickRelatedPosts(productCluster[0], all, 2);

    expect(related.map((p) => p.slug)).toContain("como-reescrever-curriculo-para-ats");
  });

  it("does not invent a bridge when the cluster is empty", () => {
    const related = pickRelatedPosts(curiosity[0], curiosity, 3);

    expect(related).toHaveLength(3);
    expect(related.every((p) => !isAtsClusterPost(p))).toBe(true);
  });
});
