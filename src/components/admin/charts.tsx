// Pure-SVG chart primitives. No external charting library — keeps bundle slim.

export type Point = { date: string; value: number };

export function LineChart({
  data,
  height = 180,
  color = "#EA580C",
  fill = "rgba(234,88,12,0.08)",
  yLabel,
  formatValue = (v) => v.toLocaleString("pt-BR"),
}: {
  data: Point[];
  height?: number;
  color?: string;
  fill?: string;
  yLabel?: string;
  formatValue?: (v: number) => string;
}) {
  if (data.length === 0) {
    return <EmptyChart height={height} />;
  }

  const W = 600;
  const H = height;
  const padL = 36;
  const padR = 8;
  const padT = 12;
  const padB = 24;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const max = Math.max(1, ...data.map((d) => d.value));
  const min = 0;
  const range = max - min || 1;
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = padL + i * stepX;
    const y = padT + innerH - ((d.value - min) / range) * innerH;
    return { x, y, ...d };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const areaD =
    pathD +
    ` L ${points[points.length - 1].x.toFixed(1)} ${(padT + innerH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padT + innerH).toFixed(1)} Z`;

  // 4 horizontal grid lines
  const gridSteps = 4;
  const grid = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const y = padT + (innerH / gridSteps) * i;
    const v = max - (range / gridSteps) * i;
    return { y, v };
  });

  // X-axis labels: first, middle, last
  const xLabels = [
    points[0],
    points[Math.floor(points.length / 2)],
    points[points.length - 1],
  ].filter((p, i, arr) => arr.findIndex((q) => q.x === p.x) === i);

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        preserveAspectRatio="none"
      >
        {/* Grid lines */}
        {grid.map((g, i) => (
          <g key={i}>
            <line
              x1={padL}
              y1={g.y}
              x2={W - padR}
              y2={g.y}
              className="stroke-neutral-200 dark:stroke-zinc-800"
              strokeWidth="1"
              strokeDasharray={i === gridSteps ? undefined : "2 3"}
            />
            <text
              x={padL - 6}
              y={g.y + 4}
              textAnchor="end"
              className="fill-text-tertiary"
              fontSize="10"
            >
              {Math.round(g.v).toLocaleString("pt-BR")}
            </text>
          </g>
        ))}

        {/* Area fill */}
        <path d={areaD} fill={fill} />
        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Data points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3" fill={color} />
            <title>
              {formatLabel(p.date)} · {formatValue(p.value)}
              {yLabel ? ` ${yLabel}` : ""}
            </title>
          </g>
        ))}

        {/* X-axis labels */}
        {xLabels.map((p, i) => (
          <text
            key={i}
            x={p.x}
            y={H - 6}
            textAnchor={i === 0 ? "start" : i === xLabels.length - 1 ? "end" : "middle"}
            className="fill-text-tertiary"
            fontSize="10"
          >
            {formatLabel(p.date)}
          </text>
        ))}
      </svg>
    </div>
  );
}

export function BarChart({
  data,
  height = 180,
  color = "#EA580C",
  formatValue = (v) => v.toLocaleString("pt-BR"),
}: {
  data: Point[];
  height?: number;
  color?: string;
  formatValue?: (v: number) => string;
}) {
  if (data.length === 0) {
    return <EmptyChart height={height} />;
  }

  const W = 600;
  const H = height;
  const padL = 36;
  const padR = 8;
  const padT = 12;
  const padB = 24;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const max = Math.max(1, ...data.map((d) => d.value));
  const stepX = innerW / data.length;
  const barW = Math.max(2, stepX * 0.7);

  const gridSteps = 4;
  const grid = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const y = padT + (innerH / gridSteps) * i;
    const v = max - (max / gridSteps) * i;
    return { y, v };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
      {grid.map((g, i) => (
        <g key={i}>
          <line
            x1={padL}
            y1={g.y}
            x2={W - padR}
            y2={g.y}
            className="stroke-neutral-200 dark:stroke-zinc-800"
            strokeWidth="1"
            strokeDasharray={i === gridSteps ? undefined : "2 3"}
          />
          <text
            x={padL - 6}
            y={g.y + 4}
            textAnchor="end"
            className="fill-text-tertiary"
            fontSize="10"
          >
            {Math.round(g.v).toLocaleString("pt-BR")}
          </text>
        </g>
      ))}

      {data.map((d, i) => {
        const h = (d.value / max) * innerH;
        const x = padL + i * stepX + (stepX - barW) / 2;
        const y = padT + innerH - h;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={h}
              fill={color}
              rx="2"
              opacity={0.85}
            />
            <title>
              {formatLabel(d.date)} · {formatValue(d.value)}
            </title>
          </g>
        );
      })}

      {[0, Math.floor(data.length / 2), data.length - 1]
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .map((idx) => {
          const d = data[idx];
          const x = padL + idx * stepX + stepX / 2;
          return (
            <text
              key={idx}
              x={x}
              y={H - 6}
              textAnchor={idx === 0 ? "start" : idx === data.length - 1 ? "end" : "middle"}
              className="fill-text-tertiary"
              fontSize="10"
            >
              {formatLabel(d.date)}
            </text>
          );
        })}
    </svg>
  );
}

function EmptyChart({ height }: { height: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-md border border-dashed border-neutral-200 text-xs text-text-tertiary dark:border-zinc-800"
      style={{ height }}
    >
      Sem dados no período.
    </div>
  );
}

function formatLabel(dateStr: string): string {
  // Expects YYYY-MM-DD
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}
