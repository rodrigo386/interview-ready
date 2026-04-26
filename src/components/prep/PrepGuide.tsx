import type { PrepGuide as PrepGuideType, CompanyIntel } from "@/lib/ai/schemas";
import { PrepCard } from "./PrepCard";
import { CompanyIntelCards } from "./CompanyIntelCards";

export const INTEL_SECTION_ID = "company-intel";

export function CompanyIntelSection({
  companyName,
  intel,
}: {
  companyName: string;
  intel: CompanyIntel;
}) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-text-primary">
        <span className="mr-2" aria-hidden>
          🏢
        </span>
        Sobre a empresa
      </h2>
      <p className="mt-1 text-sm text-text-secondary">
        Pesquisa sobre {companyName}. Use estes fatos nas suas respostas.
      </p>
      <div className="mt-6">
        <CompanyIntelCards intel={intel} />
      </div>
    </section>
  );
}

export function PrepSection({
  section,
  activeCardId,
}: {
  section: PrepGuideType["sections"][number];
  activeCardId?: string;
}) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-text-primary">
        <span className="mr-2" aria-hidden>
          {section.icon}
        </span>
        {section.title}
      </h2>
      <p className="mt-1 text-sm text-text-secondary">{section.summary}</p>
      <div className="mt-6 space-y-3">
        {section.cards.map((card) => (
          <PrepCard
            key={card.id}
            card={card}
            defaultOpen={card.id === activeCardId}
          />
        ))}
      </div>
    </section>
  );
}
