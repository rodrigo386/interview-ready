import Link from "next/link";
import {
  NODE_STATUS_LABEL,
  type JourneyNode,
  type JourneyNodeStatus,
} from "./navigation-types";

const ARC = {
  p0: [40, 200] as const,
  p1: [180, 20] as const,
  p2: [320, 200] as const,
};

function bezierPoint(t: number): readonly [number, number] {
  const u = 1 - t;
  return [
    u * u * ARC.p0[0] + 2 * u * t * ARC.p1[0] + t * t * ARC.p2[0],
    u * u * ARC.p0[1] + 2 * u * t * ARC.p1[1] + t * t * ARC.p2[1],
  ] as const;
}

function truncate(label: string, max = 16): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

const circleClass: Record<JourneyNodeStatus, string> = {
  ready: "fill-brand-600",
  generating: "fill-brand-400 animate-pulse",
  failed: "fill-red-500",
  pending: "fill-transparent stroke-border-strong [stroke-width:2]",
};

const dotClass: Record<JourneyNodeStatus, string> = {
  ready: "bg-brand-600",
  generating: "bg-brand-400 animate-pulse",
  failed: "bg-red-500",
  pending: "bg-transparent border-2 border-border-strong",
};

export function JourneyArc({
  nodes,
  activeId,
}: {
  nodes: JourneyNode[];
  activeId: string;
}) {
  return (
    <nav aria-label="Jornada do prep" className="w-full">
      <div className="hidden min-[381px]:block">
        <JourneyArcSvg nodes={nodes} activeId={activeId} />
      </div>
      <div className="block min-[381px]:hidden">
        <JourneyArcCompact nodes={nodes} activeId={activeId} />
      </div>
    </nav>
  );
}

function JourneyArcSvg({
  nodes,
  activeId,
}: {
  nodes: JourneyNode[];
  activeId: string;
}) {
  const total = Math.max(nodes.length - 1, 1);
  const positions = nodes.map((_, i) => bezierPoint(i / total));

  return (
    <svg
      viewBox="0 0 360 260"
      role="img"
      aria-label="Mapa da sua jornada de preparação"
      className="mx-auto w-full max-w-xl"
    >
      <defs>
        <style>{`
          @media (prefers-reduced-motion: no-preference) {
            .journey-arc-path {
              stroke-dasharray: 420;
              stroke-dashoffset: 420;
              animation: journey-draw 1.6s ease-out 0.1s forwards;
            }
            .journey-node {
              opacity: 0;
              animation: journey-pop 0.35s ease-out forwards;
            }
            @keyframes journey-draw {
              to { stroke-dashoffset: 0; }
            }
            @keyframes journey-pop {
              from { opacity: 0; transform: scale(0.6); }
              to   { opacity: 1; transform: scale(1); }
            }
          }
        `}</style>
      </defs>

      <path
        d={`M ${ARC.p0[0]} ${ARC.p0[1]} Q ${ARC.p1[0]} ${ARC.p1[1]} ${ARC.p2[0]} ${ARC.p2[1]}`}
        fill="none"
        stroke="#EA580C"
        strokeWidth="3"
        strokeDasharray="6 6"
        strokeLinecap="round"
        className="journey-arc-path"
      />

      {nodes.map((node, i) => {
        const [x, y] = positions[i];
        const isActive = node.id === activeId;
        const delay = 0.2 + i * 0.08;
        return (
          <Link
            key={node.id}
            href={node.href}
            aria-label={`${node.label} — ${NODE_STATUS_LABEL[node.status]}`}
            className="journey-node group outline-none"
            style={{
              animationDelay: `${delay}s`,
              transformBox: "fill-box",
              transformOrigin: "center",
            }}
          >
            <rect
              x={x - 22}
              y={y - 26}
              width={44}
              height={52}
              fill="transparent"
              className="cursor-pointer"
            />
            {isActive && (
              <circle
                cx={x}
                cy={y}
                r={18}
                className="fill-brand-600/15"
              />
            )}
            <circle
              cx={x}
              cy={y}
              r={isActive ? 13 : 11}
              className={`${circleClass[node.status]} transition-transform group-hover:scale-110 group-focus-visible:scale-110`}
            />
            <text
              x={x}
              y={y - 22}
              textAnchor="middle"
              fontSize="15"
              aria-hidden
              className="pointer-events-none select-none"
            >
              {node.icon}
            </text>
            <text
              x={x}
              y={y + 28}
              textAnchor="middle"
              fontSize="10"
              className="pointer-events-none select-none fill-text-secondary font-medium group-hover:fill-text-primary"
            >
              {truncate(node.label)}
            </text>
          </Link>
        );
      })}
    </svg>
  );
}

function JourneyArcCompact({
  nodes,
  activeId,
}: {
  nodes: JourneyNode[];
  activeId: string;
}) {
  return (
    <ul className="grid grid-cols-2 gap-2">
      {nodes.map((node) => {
        const isActive = node.id === activeId;
        return (
          <li key={node.id}>
            <Link
              href={node.href}
              aria-label={`${node.label} — ${NODE_STATUS_LABEL[node.status]}`}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "border-brand-600 bg-brand-600/10 text-text-primary"
                  : "border-border bg-surface text-text-secondary hover:border-brand-400 hover:text-text-primary"
              }`}
            >
              <span aria-hidden className="text-base leading-none">
                {node.icon}
              </span>
              <span className="truncate">{node.label}</span>
              <span
                aria-hidden
                className={`ml-auto h-2 w-2 shrink-0 rounded-full ${dotClass[node.status]}`}
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
