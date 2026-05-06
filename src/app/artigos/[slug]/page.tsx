import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import {
  getAllPosts,
  getPostBySlug,
  listSlugs,
  formatPublishedDate,
} from "@/lib/blog/posts";
import { extractH2Headings, pickRelatedPosts } from "@/lib/blog/related";

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://prepavaga.com.br";

export async function generateStaticParams() {
  const slugs = await listSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return {};

  const url = `/artigos/${post.slug}`;
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.description,
      url,
      type: "article",
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt ?? post.publishedAt,
      authors: post.author ? [post.author] : undefined,
      tags: post.tags,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const articleUrl = `${SITE_URL}/artigos/${post.slug}`;
  const articleImage = `${SITE_URL}/artigos/${post.slug}/opengraph-image`;

  const isPersonAuthor =
    !!post.author && !/equipe|prepavaga|team/i.test(post.author);
  const author = isPersonAuthor
    ? { "@type": "Person" as const, name: post.author!, url: SITE_URL }
    : {
        "@type": "Organization" as const,
        name: post.author ?? "PrepaVaga",
        url: SITE_URL,
      };

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    image: [articleImage],
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    inLanguage: "pt-BR",
    author,
    publisher: {
      "@type": "Organization",
      name: "PrepaVaga",
      url: SITE_URL,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/icon.svg` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": articleUrl },
    url: articleUrl,
    keywords: post.tags?.join(", "),
  };

  const headings = extractH2Headings(post.content);
  const isHowTo =
    /^como\s/i.test(post.title) ||
    /^quais\s/i.test(post.title) ||
    /^pretens/i.test(post.title);
  const howToJsonLd =
    isHowTo && headings.length >= 3
      ? {
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: post.title,
          description: post.description,
          inLanguage: "pt-BR",
          totalTime: `PT${Math.max(post.readingMinutes, 5)}M`,
          step: headings.map((h, i) => ({
            "@type": "HowToStep",
            position: i + 1,
            name: h,
            url: `${articleUrl}#${slugifyHeading(h)}`,
          })),
        }
      : null;

  const allPosts = await getAllPosts();
  const related = pickRelatedPosts(post, allPosts, 3);

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: SITE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: "Artigos",
        item: `${SITE_URL}/artigos`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: post.title,
        item: articleUrl,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {howToJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
        />
      ) : null}
      <LandingNavbar />
      <main className="bg-bg">
        <article className="mx-auto max-w-3xl px-6 py-14">
          <nav aria-label="Breadcrumb" className="text-xs text-text-tertiary">
            <Link href="/" className="hover:text-text-primary hover:underline">
              Início
            </Link>
            <span aria-hidden className="mx-2">
              ›
            </span>
            <Link href="/artigos" className="hover:text-text-primary hover:underline">
              Artigos
            </Link>
            <span aria-hidden className="mx-2">
              ›
            </span>
            <span aria-current="page" className="text-text-primary">
              {post.title.length > 50 ? `${post.title.slice(0, 50)}…` : post.title}
            </span>
          </nav>

          <header className="mt-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-orange-700">
              {post.tags?.[0] ?? "Artigo"}
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink md:text-4xl">
              {post.title}
            </h1>
            <p className="mt-4 text-base leading-[1.55] text-ink-2 md:text-lg">
              {post.description}
            </p>
            <p className="mt-4 text-xs text-text-tertiary">
              Publicado em {formatPublishedDate(post.publishedAt)}
              {post.author ? ` · por ${post.author}` : ""} · {post.readingMinutes} min de
              leitura
            </p>
          </header>

          <div className="prose prose-neutral mt-10 max-w-none prose-headings:tracking-tight prose-headings:text-ink prose-h2:mt-12 prose-h2:text-2xl prose-h2:font-extrabold prose-h3:mt-8 prose-h3:text-lg prose-h3:font-bold prose-p:text-ink-2 prose-p:leading-[1.7] prose-strong:text-ink prose-a:text-orange-700 prose-a:underline-offset-4 hover:prose-a:underline prose-blockquote:border-orange-500 prose-blockquote:text-ink-2 prose-blockquote:font-normal prose-li:text-ink-2 prose-li:my-1 prose-hr:border-line dark:prose-invert">
            <MDXRemote source={post.content} />
          </div>

          <footer className="mt-14 rounded-xl border border-line bg-white p-6 shadow-prep">
            <h2 className="text-lg font-bold text-ink">
              Quer aplicar isso na sua próxima entrevista?
            </h2>
            <p className="mt-2 text-sm text-ink-2">
              A PrepaVaga gera um pitch personalizado de 90 segundos para uma vaga específica,
              junto com análise ATS do seu currículo, pesquisa atualizada da empresa e perguntas
              prováveis. A primeira preparação é grátis.
            </p>
            <Link
              href="/signup"
              className="mt-4 inline-block rounded-pill bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
            >
              Gerar minha preparação grátis →
            </Link>
          </footer>

          {related.length > 0 ? (
            <aside aria-labelledby="leia-tambem" className="mt-14">
              <h2
                id="leia-tambem"
                className="text-xs font-bold uppercase tracking-[0.6px] text-text-tertiary"
              >
                Leia também
              </h2>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((r) => (
                  <li key={r.slug}>
                    <Link
                      href={`/artigos/${r.slug}`}
                      className="block h-full rounded-xl border border-line bg-white p-5 transition hover:border-orange-500 hover:shadow-prep"
                    >
                      <p className="text-[10px] font-bold uppercase tracking-[0.6px] text-orange-700">
                        {r.tags?.[0] ?? "Artigo"}
                      </p>
                      <p className="mt-2 text-sm font-semibold leading-snug text-ink">
                        {r.title}
                      </p>
                      <p className="mt-2 line-clamp-3 text-xs text-ink-2">
                        {r.description}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </aside>
          ) : null}
        </article>
      </main>
      <LandingFooter />
    </>
  );
}

function slugifyHeading(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}
