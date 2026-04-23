import Link from "next/link";
import {
  NODE_STATUS_LABEL,
  type JourneyNode,
  type JourneyNodeStatus,
} from "./navigation-types";

const dotClass: Record<JourneyNodeStatus, string> = {
  ready: "bg-emerald-500",
  generating: "bg-blue-500 animate-pulse",
  failed: "bg-red-500",
  pending: "bg-zinc-400/60",
};

export function SectionTabs({
  nodes,
  activeId,
}: {
  nodes: JourneyNode[];
  activeId: string;
}) {
  return (
    <nav
      aria-label="Seções do prep"
      className="sticky top-0 z-10 -mx-4 border-b border-border bg-bg/90 px-4 py-2 backdrop-blur-sm md:-mx-6 md:px-6"
    >
      <ul className="flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0">
        {nodes.map((node) => {
          const isActive = node.id === activeId;
          return (
            <li key={node.id} className="shrink-0">
              <Link
                href={node.href}
                aria-current={isActive ? "page" : undefined}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? "bg-brand-600 text-white"
                    : "bg-surface-muted text-text-secondary hover:bg-surface hover:text-text-primary"
                }`}
              >
                <span aria-hidden className="text-base leading-none">
                  {node.icon}
                </span>
                <span className="whitespace-nowrap">{node.label}</span>
                <span
                  aria-label={NODE_STATUS_LABEL[node.status]}
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass[node.status]}`}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
