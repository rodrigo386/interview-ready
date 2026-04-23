"use client";

export function gaugeColor(value: number): string {
  if (value <= 40) return "var(--prep-red)";
  if (value <= 70) return "var(--prep-yellow)";
  return "var(--prep-green)";
}

export function Gauge({ value, max = 100 }: { value: number; max?: number }) {
  const radius = 88;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(value, max));
  const dash = (clamped / max) * circumference;
  const stroke = gaugeColor(clamped);

  return (
    <div
      role="meter"
      aria-label="Score ATS"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={max}
      className="relative inline-flex h-[200px] w-[200px] items-center justify-center"
    >
      <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
        <circle cx="100" cy="100" r={radius} fill="none" stroke="#E8E8E8" strokeWidth="14" />
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{
            transition: "stroke-dasharray 1.2s ease-out, stroke 0.4s ease",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[48px] font-extrabold leading-none text-ink">{clamped}</span>
        <span className="mt-1 text-xs font-semibold text-ink-3">DE {max}</span>
      </div>
    </div>
  );
}
