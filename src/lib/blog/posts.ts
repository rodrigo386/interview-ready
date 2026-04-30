import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

export type PostFrontmatter = {
  title: string;
  description: string;
  publishedAt: string;
  updatedAt?: string;
  author?: string;
  tags?: string[];
};

export type PostSummary = PostFrontmatter & {
  slug: string;
  readingMinutes: number;
};

export type PostFull = PostSummary & {
  content: string;
};

const POSTS_DIR = path.join(process.cwd(), "content", "posts");

function computeReadingMinutes(text: string): number {
  // ~200 wpm average reading speed for Portuguese.
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

async function readPostFile(slug: string): Promise<PostFull | null> {
  const filePath = path.join(POSTS_DIR, `${slug}.mdx`);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const { data, content } = matter(raw);
    const fm = data as PostFrontmatter;
    if (!fm.title || !fm.description || !fm.publishedAt) {
      throw new Error(`Post ${slug} missing required frontmatter`);
    }
    return {
      ...fm,
      slug,
      content,
      readingMinutes: computeReadingMinutes(content),
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function listSlugs(): Promise<string[]> {
  try {
    const entries = await fs.readdir(POSTS_DIR);
    return entries
      .filter((f) => f.endsWith(".mdx"))
      .map((f) => f.replace(/\.mdx$/, ""));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

export async function getAllPosts(): Promise<PostSummary[]> {
  const slugs = await listSlugs();
  const posts = await Promise.all(slugs.map(readPostFile));
  return posts
    .filter((p): p is PostFull => p !== null)
    .map(({ content: _content, ...summary }) => summary)
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );
}

export async function getPostBySlug(slug: string): Promise<PostFull | null> {
  return readPostFile(slug);
}

export function formatPublishedDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}
