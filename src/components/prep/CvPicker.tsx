"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { uploadCv, type UploadCvState } from "@/app/prep/new/cv-actions";
import { LinkedInImportHelper } from "./LinkedInImportHelper";

export type CvSummary = {
  id: string;
  file_name: string;
  created_at: string;
};

type Mode = "select" | "upload" | "paste";

export function CvPicker({
  existingCvs,
  onResolved,
}: {
  existingCvs: CvSummary[];
  /** Called whenever the parent form should update its hidden inputs. */
  onResolved: (v: { cvId: string | null; cvText: string | null }) => void;
}) {
  const [mode, setMode] = useState<Mode>(existingCvs.length > 0 ? "select" : "upload");
  const [selectedCvId, setSelectedCvId] = useState<string | null>(
    existingCvs[0]?.id ?? null,
  );
  const [uploaded, setUploaded] = useState<{ id: string; file_name: string } | null>(null);
  const [pasted, setPasted] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadPending, startUpload] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setUploadError(null);
    const fd = new FormData();
    fd.append("file", file);
    startUpload(async () => {
      const result: UploadCvState = await uploadCv({}, fd);
      if (result.cv) {
        setUploaded(result.cv);
        setMode("upload");
        onResolved({ cvId: result.cv.id, cvText: null });
      } else if (result.error) {
        setUploadError(result.error);
      }
    });
  };

  useEffect(() => {
    if (mode === "select") {
      onResolved({ cvId: selectedCvId, cvText: null });
    } else if (mode === "paste") {
      onResolved({ cvId: null, cvText: pasted.length >= 200 ? pasted : null });
    }
  }, [mode, selectedCvId, pasted, onResolved]);

  return (
    <div className="space-y-4">
      {existingCvs.length > 0 && (
        <fieldset className="space-y-1 rounded-xl border border-line bg-surface p-3">
          <legend className="px-1 text-xs font-medium uppercase tracking-wide text-text-muted">
            Usar um CV já enviado
          </legend>
          {existingCvs.map((cv) => (
            <label
              key={cv.id}
              className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-bg"
            >
              <input
                type="radio"
                name="cvPick"
                value={cv.id}
                checked={mode === "select" && selectedCvId === cv.id}
                onChange={() => {
                  setMode("select");
                  setSelectedCvId(cv.id);
                }}
              />
              <span className="text-sm text-text-primary">{cv.file_name}</span>
              <span className="ml-auto text-xs text-text-muted">
                {new Date(cv.created_at).toLocaleDateString()}
              </span>
            </label>
          ))}
        </fieldset>
      )}

      {mode !== "paste" && (
        <div className="space-y-3">
          <LinkedInImportHelper />
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line bg-surface px-4 py-8 text-center transition hover:border-orange-500 hover:bg-orange-soft/40">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
              disabled={uploadPending}
            />
            <span className="text-sm text-text-primary">
              {uploadPending
                ? "Enviando e processando…"
                : uploaded
                  ? `Enviado: ${uploaded.file_name}`
                  : "Arraste seu CV aqui, ou clique para escolher"}
            </span>
            <span className="text-xs text-text-muted">PDF, DOCX ou TXT · máximo 5MB</span>
          </label>
          {uploadError && (
            <p className="mt-2 text-sm text-red-500" role="alert">
              {uploadError}
            </p>
          )}
        </div>
      )}

      {mode === "paste" ? (
        <div>
          <label htmlFor="cvPasteArea" className="block text-xs text-text-muted">
            Cole o texto do seu CV (mínimo 200 caracteres)
          </label>
          <textarea
            id="cvPasteArea"
            rows={10}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder="Cole aqui o texto do seu CV."
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
          />
          <button
            type="button"
            className="mt-2 text-xs text-text-muted underline hover:text-text-primary"
            onClick={() => setMode(existingCvs.length > 0 ? "select" : "upload")}
          >
            Voltar ao upload
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="text-xs text-text-muted underline hover:text-text-primary"
          onClick={() => setMode("paste")}
        >
          Colar texto em vez disso
        </button>
      )}
    </div>
  );
}
