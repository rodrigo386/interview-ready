import Link from "next/link";
import { getAllPosts } from "@/lib/blog/posts";

/**
 * Renders 4 featured articles as direct links from the landing page.
 *
 * SEO: brings article URLs to depth-1 from the homepage (instead of depth-2
 * via /artigos), giving Google strong internal-linking signal. Helps move
 * articles out of "Discovered – currently not indexed" by raising their
 * perceived importance and giving the crawler a direct path.
 */
export async function FeaturedArticles() {
  const posts = await getAllPosts();
  if (posts.length === 0) return null;
  const featured = posts.slice(0, 4);

  return (
    <section
      id="artigos-destaque"
      aria-labelledby="artigos-destaque-title"
      className="border-t border-neutral-200 bg-bg dark:border-zinc-800"
    >
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 md:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-orange-700">
            Da nossa newsletter
          </p>
          <h2
            id="artigos-destaque-title"
            className="mt-2 font-serif text-3xl font-normal tracking-tight text-text-primary md:text-4xl"
          >
            Guias práticos pra sua próxima entrevista
          </h2>
          <p className="mt-3 text-base text-text-secondary">
            Artigos curtos, sem teoria genérica. Direto ao que muda o resultado
            da sua entrevista.
          </p>
        </div>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/artigos/${p.slug}`}
                className="group block h-full rounded-xl border border-neutral-200 bg-bg p-5 transition hover:border-orange-500 hover:shadow-prep dark:border-zinc-800"
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.6px] text-orange-700">
                  {p.tags?.[0] ?? "Artigo"} · {p.readingMinutes} min
                </p>
                <h3 className="mt-2 text-base font-bold leading-snug text-text-primary group-hover:text-orange-700">
                  {p.title}
                </h3>
                <p className="mt-2 line-clamp-3 text-sm leading-[1.5] text-text-secondary">
                  {p.description}
                </p>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-10 text-center">
          <Link
            href="/artigos"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-700 transition hover:text-orange-500"
          >
            Ver todos os artigos
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
