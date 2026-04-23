import Link from "next/link";

type FocusCardBaseProps = {
  stepChip: string;
  title: string;
  description: string;
  ctaLabel: string;
};

type FocusCardProps = FocusCardBaseProps &
  (
    | { ctaHref: string; onCtaClick?: never }
    | { onCtaClick: () => void; ctaHref?: never }
  );

export function FocusCard(props: FocusCardProps) {
  const { stepChip, title, description, ctaLabel } = props;
  const cta = (
    <span className="inline-flex items-center justify-center rounded-pill bg-white px-8 py-3.5 text-sm font-semibold text-orange-700 shadow-prep transition-colors hover:bg-orange-soft">
      {ctaLabel}
    </span>
  );
  return (
    <section
      className="rounded-xl px-6 py-10 text-center text-white shadow-prep md:px-8 md:py-12"
      style={{ background: "linear-gradient(135deg, #F15A24 0%, #D94818 100%)" }}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-white/80">
        {stepChip}
      </p>
      <h2 className="mt-3 text-2xl font-extrabold tracking-tight md:text-[28px]">
        {title}
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-[15px] leading-6 text-white/90">
        {description}
      </p>
      <div className="mt-6">
        {"ctaHref" in props && props.ctaHref ? (
          <Link href={props.ctaHref} className="inline-block focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-orange-500 rounded-pill">
            {cta}
          </Link>
        ) : (
          <button
            type="button"
            onClick={props.onCtaClick}
            className="inline-block focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-orange-500 rounded-pill"
          >
            {cta}
          </button>
        )}
      </div>
    </section>
  );
}
