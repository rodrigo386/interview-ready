"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { uploadCv, type UploadCvState } from "@/app/prep/new/cv-actions";

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

  const [uploadState, uploadAction, uploadPending] = useActionState<
    UploadCvState,
    FormData
  >(uploadCv, {});
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (uploadState.cv) {
      setUploaded(uploadState.cv);
      setMode("upload");
      onResolved({ cvId: uploadState.cv.id, cvText: null });
    }
  }, [uploadState.cv, onResolved]);

  useEffect(() => {
    if (mode === "select") {
      onResolved({ cvId: selectedCvId, cvText: null });
    } else if (mode === "paste") {
      onResolved({ cvId: null, cvText: pasted.length >= 200 ? pasted : null });
    }
  }, [mode, selectedCvId, pasted, onResolved]);

  return (
    <div className="space-y-4">
      <label className="block text-sm text-zinc-300">Your CV</label>

      {existingCvs.length > 0 && (
        <fieldset className="space-y-2 rounded-md border border-zinc-800 bg-zinc-900/40 p-4">
          <legend className="px-1 text-xs uppercase tracking-wide text-zinc-400">
            Use an existing CV
          </legend>
          {existingCvs.map((cv) => (
            <label
              key={cv.id}
              className="flex cursor-pointer items-center gap-3 rounded px-2 py-1 hover:bg-zinc-900"
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
              <span className="text-sm text-zinc-100">{cv.file_name}</span>
              <span className="ml-auto text-xs text-zinc-500">
                {new Date(cv.created_at).toLocaleDateString()}
              </span>
            </label>
          ))}
        </fieldset>
      )}

      {mode !== "paste" && (
        <form action={uploadAction}>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-zinc-800 bg-zinc-900/30 px-4 py-8 text-center hover:border-zinc-700">
            <input
              ref={fileRef}
              type="file"
              name="file"
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) e.target.form?.requestSubmit();
              }}
              disabled={uploadPending}
            />
            <span className="text-sm text-zinc-200">
              {uploadPending
                ? "Uploading and parsing…"
                : uploaded
                  ? `Uploaded: ${uploaded.file_name}`
                  : "Drop your CV here, or click to browse"}
            </span>
            <span className="text-xs text-zinc-500">PDF, DOCX, or TXT · max 5MB</span>
          </label>
          {uploadState.error && (
            <p className="mt-2 text-sm text-red-400" role="alert">
              {uploadState.error}
            </p>
          )}
        </form>
      )}

      {mode === "paste" ? (
        <div>
          <label htmlFor="cvPasteArea" className="block text-xs text-zinc-400">
            Paste your CV text (min 200 chars)
          </label>
          <textarea
            id="cvPasteArea"
            rows={10}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder="Paste your CV text here."
            className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
          <button
            type="button"
            className="mt-2 text-xs text-zinc-400 underline hover:text-zinc-200"
            onClick={() => setMode(existingCvs.length > 0 ? "select" : "upload")}
          >
            Back to upload
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="text-xs text-zinc-400 underline hover:text-zinc-200"
          onClick={() => setMode("paste")}
        >
          Paste text instead
        </button>
      )}
    </div>
  );
}
