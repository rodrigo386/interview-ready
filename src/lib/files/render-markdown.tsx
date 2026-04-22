import type { ReactNode } from "react";

/**
 * Render a small markdown subset (matching mdToDocx) to React nodes.
 * Shared subset so the inline preview matches what the downloaded DOCX contains.
 */
export function renderMarkdown(markdown: string): ReactNode {
  const lines = markdown.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let bulletBuffer: string[] = [];

  const flushBullets = () => {
    if (bulletBuffer.length === 0) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="list-disc space-y-1 pl-5">
        {bulletBuffer.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>,
    );
    bulletBuffer = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") {
      flushBullets();
      continue;
    }
    if (trimmed.startsWith("### ")) {
      flushBullets();
      blocks.push(
        <h4 key={`h4-${blocks.length}`} className="mt-4 text-sm font-semibold text-zinc-100">
          {renderInline(trimmed.slice(4))}
        </h4>,
      );
      continue;
    }
    if (trimmed.startsWith("## ")) {
      flushBullets();
      blocks.push(
        <h3
          key={`h3-${blocks.length}`}
          className="mt-5 text-base font-semibold text-zinc-100"
        >
          {renderInline(trimmed.slice(3))}
        </h3>,
      );
      continue;
    }
    if (trimmed.startsWith("- ")) {
      bulletBuffer.push(trimmed.slice(2));
      continue;
    }
    flushBullets();
    blocks.push(
      <p key={`p-${blocks.length}`} className="mt-2 text-sm text-zinc-200">
        {renderInline(trimmed)}
      </p>,
    );
  }
  flushBullets();
  return <>{blocks}</>;
}

function renderInline(line: string): ReactNode[] {
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  return parts
    .filter((p) => p !== "")
    .map((p, i) =>
      p.startsWith("**") && p.endsWith("**") ? (
        <strong key={i} className="font-semibold">
          {p.slice(2, -2)}
        </strong>
      ) : (
        <span key={i}>{p}</span>
      ),
    );
}
