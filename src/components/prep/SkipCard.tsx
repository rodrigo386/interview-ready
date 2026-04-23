import Link from "next/link";

export function SkipCard({
  prompt,
  ctaLabel,
  href,
}: {
  prompt: string;
  ctaLabel: string;
  href: string;
}) {
  return (
    <div className="mt-4 flex items-center justify-between gap-4 rounded-md border border-line bg-bg px-5 py-3 text-[13px] text-ink-2">
      <span>{prompt}</span>
      <Link href={href} className="font-semibold text-orange-700 hover:text-orange-500">
        {ctaLabel}
      </Link>
    </div>
  );
}
