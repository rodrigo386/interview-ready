"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { UnifiedCv } from "@/lib/profile/types";
import type { ActionResult } from "@/app/(app)/profile/actions";

export function CvRow({
  cv,
  deleteUpload,
  rename,
  deleteAi,
}: {
  cv: UnifiedCv;
  deleteUpload: (input: { cvId: string }) => Promise<ActionResult>;
  rename: (input: { cvId: string; displayName: string }) => Promise<ActionResult>;
  deleteAi: (input: { prepSessionId: string }) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(
    cv.origin === "upload" ? cv.displayName : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isUpload = cv.origin === "upload";
  const title = isUpload ? cv.displayName : `${cv.companyName} — ${cv.jobTitle}`;
  const timestamp = isUpload ? cv.createdAt : cv.updatedAt;
  const downloadHref = isUpload
    ? `/api/cv/${cv.id}/download`
    : `/prep/${cv.prepSessionId}/cv-rewrite.docx`;

  const onDelete = () => {
    setError(null);
    if (!confirm("Excluir este CV?")) return;
    startTransition(async () => {
      const result = isUpload
        ? await deleteUpload({ cvId: cv.id })
        : await deleteAi({ prepSessionId: cv.prepSessionId });
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  };

  const onRenameSubmit = () => {
    if (!isUpload) return;
    setError(null);
    startTransition(async () => {
      const result = await rename({ cvId: cv.id, displayName: draftName.trim() });
      if (!result.ok) setError(result.error);
      else {
        setRenaming(false);
        router.refresh();
      }
    });
  };

  return (
    <li className="flex items-center justify-between gap-4 rounded-md border border-border bg-bg p-4">
      <div className="min-w-0 flex-1">
        {renaming ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              maxLength={80}
              className="flex-1 rounded-md border border-border bg-bg px-2 py-1 text-sm"
            />
            <button
              type="button"
              disabled={pending}
              onClick={onRenameSubmit}
              className="text-sm font-medium text-brand-600"
            >
              Salvar
            </button>
            <button
              type="button"
              onClick={() => {
                setRenaming(false);
                setDraftName(cv.origin === "upload" ? cv.displayName : "");
              }}
              className="text-sm text-text-secondary"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <p className="truncate text-sm font-medium text-text-primary">{title}</p>
        )}
        <p className="mt-1 text-xs text-text-tertiary">
          {new Date(timestamp).toLocaleDateString("pt-BR", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </p>
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
      <span
        className={`shrink-0 rounded-pill border px-2 py-0.5 text-xs font-medium ${
          isUpload
            ? "border-line text-text-secondary"
            : "border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-950"
        }`}
      >
        {isUpload ? "Original" : "Reescrito pela IA"}
      </span>
      <div className="relative shrink-0">
        <button
          type="button"
          aria-label="Opções"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md px-2 py-1 text-text-secondary hover:bg-line"
        >
          •••
        </button>
        {open && (
          <div
            role="menu"
            className="absolute right-0 z-30 mt-2 w-44 rounded-md border border-border bg-bg shadow-prep"
          >
            <Link
              href={downloadHref}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm text-text-primary hover:bg-line"
            >
              Baixar
            </Link>
            {isUpload && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  setRenaming(true);
                }}
                className="block w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-line"
              >
                Renomear
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-line"
            >
              Excluir
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
