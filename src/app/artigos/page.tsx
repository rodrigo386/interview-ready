import type { Metadata } from "next";
import Link from "next/link";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { getAllPosts, formatPublishedDate } from "@/lib/blog/posts";

export const metadata: Metadata = {
  title: "Artigos sobre entrevista e carreira",
  description:
    "Guias práticos sobre entrevista de emprego, currículo ATS, perguntas comuns e estratégias de carreira. Conteúdo da equipe PrepaVAGA.",
  alternates: { canonical: "/artigos" },
  openGraph: {
    title: "Artigos · PrepaVAGA",
    description:
      "Guias práticos sobre entrevista de emprego, currículo ATS e perguntas comuns.",
    url: "/artigos",
  },
};

export default async function ArticlesIndexPage() {
  const posts = await getAllPosts();

  return (
    <>
      <LandingNavbar />
      <main className="bg-bg">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <header className="mb-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-orange-700">
              Artigos PrepaVAGA
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink md:text-4xl">
              Guias para a sua próxima entrevista
            </h1>
            <p className="mt-3 text-base text-ink-2">
              Estratégias práticas sobre entrevista de emprego, currículo ATS e
              perguntas comuns. Sem teoria genérica.
            </p>
          </header>

          {posts.length === 0 ? (
            <p className="text-sm text-text-tertiary">Em breve.</p>
          ) : (
            <ul className="space-y-6">
              {posts.map((p) => (
                <li
                  key={p.slug}
                  className="group rounded-xl border border-line bg-white p-5 shadow-prep transition hover:border-orange-500"
                >
                  <Link href={`/artigos/${p.slug}`} className="block">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
                      {formatPublishedDate(p.publishedAt)} · {p.readingMinutes} min de leitura
                    </p>
                    <h2 className="mt-1 text-lg font-bold text-ink group-hover:text-orange-700 md:text-xl">
                      {p.title}
                    </h2>
                    <p className="mt-2 text-sm leading-[1.55] text-ink-2">{p.description}</p>
                    {p.tags && p.tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {p.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded-pill bg-bg px-2 py-0.5 text-[11px] text-text-tertiary"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
      <LandingFooter />
    </>
  );
}
