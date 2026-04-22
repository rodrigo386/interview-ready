# CV File Upload (#2b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the CV textarea on `/prep/new` with a PDF/DOCX/TXT upload that parses text server-side, caches it in a new `cvs` table, and lets users pick a previously-uploaded CV.

**Architecture:** Server Action `uploadCv` parses the binary and stores it in Supabase Storage (`cvs` bucket) + a `cvs` row. `createPrep` accepts either a `cvId` or a `cvText` paste fallback. The existing `runGeneration` pipeline is untouched — it still reads `prep_sessions.cv_text`, which we populate from `cvs.parsed_text` when a file is used.

**Tech Stack:** Next.js 15 Server Actions, Supabase Storage with RLS, `pdf-parse` (PDFs), `mammoth` (DOCX), Vitest (unit), Playwright (E2E). Dev deps `pdf-lib` + `docx` used only to generate binary test fixtures at runtime — no on-disk binary fixtures.

**Branch:** `file-upload/2b` (already checked out)

**Spec reference:** `docs/superpowers/specs/2026-04-21-file-upload-design.md`

---

## File Structure

### Created
| Path | Purpose |
|---|---|
| `supabase/migrations/0005_cvs.sql` | `cvs` table + RLS + `prep_sessions.cv_id` FK |
| `supabase/migrations/0005_cvs_storage_policies.sql` | Storage RLS policies (applied separately via dashboard, after bucket exists) |
| `src/lib/files/parse.ts` | PDF/DOCX/TXT → text; throws `ParseError` when <200 chars |
| `src/lib/files/parse.test.ts` | Parser unit tests (generates fixtures at runtime) |
| `src/app/prep/new/cv-actions.ts` | `uploadCv` Server Action |
| `src/components/prep/CvPicker.tsx` | Client sub-component: select existing / upload new / paste fallback |
| `tests/e2e/upload.spec.ts` | E2E: upload → create prep, reuse, paste fallback, parse failure |

### Modified
| Path | Change |
|---|---|
| `package.json` | Add `pdf-parse`, `mammoth`; dev-deps `pdf-lib`, `docx`, `@types/pdf-parse` |
| `src/app/prep/new/page.tsx` | Fetch user's CVs, pass to `NewPrepForm` |
| `src/app/prep/new/actions.ts` | New Zod schema (cvId XOR cvText) + cvId resolution path |
| `src/components/prep/NewPrepForm.tsx` | Replace CV textarea with `<CvPicker>`; accept `existingCvs` prop |
| `tests/e2e/prep.spec.ts` | Click "Paste text instead" link before filling the paste textarea |

### Unchanged
- `runGeneration`, `generateSection`, `generateAtsAnalysis`, all schemas, ATS flow

---

## Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1.1: Install runtime deps**

```bash
pnpm add pdf-parse mammoth
```

- [ ] **Step 1.2: Install dev deps (test fixture generators + types)**

```bash
pnpm add -D pdf-lib docx @types/pdf-parse
```

- [ ] **Step 1.3: Verify install**

```bash
pnpm typecheck
```

Expected: exits 0 (no new type errors yet — nothing consumes the deps).

- [ ] **Step 1.4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "deps(2b): pdf-parse, mammoth, pdf-lib, docx for CV upload"
```

---

## Task 2: Migration SQL files

**Files:**
- Create: `supabase/migrations/0005_cvs.sql`
- Create: `supabase/migrations/0005_cvs_storage_policies.sql`

- [ ] **Step 2.1: Write the table migration**

`supabase/migrations/0005_cvs.sql`:

```sql
CREATE TABLE public.cvs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size_bytes INT NOT NULL,
  mime_type TEXT NOT NULL,
  parsed_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.cvs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own cvs"
  ON public.cvs FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "insert own cvs"
  ON public.cvs FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete own cvs"
  ON public.cvs FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_cvs_user ON public.cvs(user_id, created_at DESC);

ALTER TABLE public.prep_sessions
  ADD COLUMN cv_id UUID REFERENCES public.cvs(id) ON DELETE SET NULL;
```

- [ ] **Step 2.2: Write the storage policies**

`supabase/migrations/0005_cvs_storage_policies.sql`:

```sql
-- Apply AFTER creating the "cvs" bucket in the Supabase Dashboard (Storage UI).
-- Bucket must be PRIVATE. These policies enforce per-user folder isolation.

CREATE POLICY "cvs: upload own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'cvs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "cvs: read own files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'cvs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "cvs: delete own files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'cvs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

- [ ] **Step 2.3: Commit**

```bash
git add supabase/migrations/0005_cvs.sql supabase/migrations/0005_cvs_storage_policies.sql
git commit -m "feat(db,2b): migration 0005 cvs table + storage policies"
```

---

## Task 3: File parser module (TDD)

**Files:**
- Create: `src/lib/files/parse.ts`
- Create: `src/lib/files/parse.test.ts`

- [ ] **Step 3.1: Write the failing tests**

`src/lib/files/parse.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { parseCvFile, ParseError } from "./parse";

const LONG_TEXT =
  "Rodrigo Costa — 10 years in procurement leadership. " +
  "Led $500M addressable spend rollout of e-sourcing platform across 12 LATAM countries. " +
  "Delivered 18% cost takeout and 40% cycle-time reduction over 24 months. " +
  "Digital procurement transformation at Bayer 2019-2022. MBA Insead 2018. " +
  "Private Equity portfolio CFO advisor 2022-present. Senior Director candidate.";

async function makePdf(text: string): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([600, 800]);
  page.drawText(text, { x: 40, y: 760, size: 10, font, maxWidth: 520, lineHeight: 14 });
  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

async function makeEmptyPdf(): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.addPage([600, 800]);
  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

async function makeDocx(text: string): Promise<Buffer> {
  const doc = new Document({
    sections: [{ children: [new Paragraph({ children: [new TextRun(text)] })] }],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}

describe("parseCvFile", () => {
  let pdfBuf: Buffer;
  let docxBuf: Buffer;
  let emptyPdfBuf: Buffer;

  beforeAll(async () => {
    pdfBuf = await makePdf(LONG_TEXT);
    docxBuf = await makeDocx(LONG_TEXT);
    emptyPdfBuf = await makeEmptyPdf();
  });

  it("extracts text from a PDF", async () => {
    const { text } = await parseCvFile(pdfBuf, "application/pdf");
    expect(text.length).toBeGreaterThanOrEqual(200);
    expect(text).toMatch(/Rodrigo Costa/);
  });

  it("extracts text from a DOCX", async () => {
    const { text } = await parseCvFile(
      docxBuf,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(text.length).toBeGreaterThanOrEqual(200);
    expect(text).toMatch(/Rodrigo Costa/);
  });

  it("extracts text from plain TXT", async () => {
    const { text } = await parseCvFile(Buffer.from(LONG_TEXT, "utf8"), "text/plain");
    expect(text).toContain("Rodrigo Costa");
  });

  it("rejects an image-only PDF with ParseError", async () => {
    await expect(
      parseCvFile(emptyPdfBuf, "application/pdf"),
    ).rejects.toBeInstanceOf(ParseError);
  });

  it("rejects unknown mime type", async () => {
    await expect(
      parseCvFile(Buffer.from("x"), "application/zip"),
    ).rejects.toBeInstanceOf(ParseError);
  });

  it("collapses 3+ blank lines to 2", async () => {
    const dirty = "a" + "\n".repeat(6) + "b".repeat(300);
    const { text } = await parseCvFile(Buffer.from(dirty, "utf8"), "text/plain");
    expect(text).not.toMatch(/\n{3,}/);
  });
});
```

- [ ] **Step 3.2: Run the tests — expect failure**

```bash
pnpm test src/lib/files/parse.test.ts
```

Expected: fails with "Cannot find module ./parse".

- [ ] **Step 3.3: Write the implementation**

`src/lib/files/parse.ts`:

```typescript
import mammoth from "mammoth";
// Direct import of the library file bypasses pdf-parse's index.js debug harness
// that tries to read ./test/data/... at import time.
import pdfParse from "pdf-parse/lib/pdf-parse.js";

export type ParsedCV = { text: string; pageCount?: number };

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

const MIN_CHARS = 200;

const PDF_MIME = "application/pdf";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const TXT_MIME = "text/plain";

export const ACCEPTED_MIME_TYPES = [PDF_MIME, DOCX_MIME, TXT_MIME] as const;

export async function parseCvFile(
  buffer: Buffer,
  mimeType: string,
): Promise<ParsedCV> {
  let raw: string;
  let pageCount: number | undefined;

  if (mimeType === PDF_MIME) {
    const result = await pdfParse(buffer);
    raw = result.text;
    pageCount = result.numpages;
  } else if (mimeType === DOCX_MIME) {
    const result = await mammoth.extractRawText({ buffer });
    raw = result.value;
  } else if (mimeType === TXT_MIME) {
    raw = buffer.toString("utf8");
  } else {
    throw new ParseError(
      `Unsupported file type: ${mimeType}. Upload a PDF, DOCX, or TXT.`,
    );
  }

  const text = normalize(raw);

  if (text.length < MIN_CHARS) {
    throw new ParseError(
      "We couldn't extract enough text from this file. It may be a scanned image. Try pasting the text instead.",
    );
  }

  return { text, pageCount };
}

function normalize(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
```

- [ ] **Step 3.4: Run the tests — expect pass**

```bash
pnpm test src/lib/files/parse.test.ts
```

Expected: 6 passing.

If `pdf-parse/lib/pdf-parse.js` resolution fails: check the installed path with `ls node_modules/pdf-parse/lib/`; fall back to `import pdf from "pdf-parse"` with a try/catch and a one-time `fs.mkdirSync("./test/data", { recursive: true })` shim in a `vitest.setup.ts`. (Prefer the direct-file import — it is the published, supported workaround.)

- [ ] **Step 3.5: Commit**

```bash
git add src/lib/files/parse.ts src/lib/files/parse.test.ts
git commit -m "feat(files,2b): parseCvFile for PDF/DOCX/TXT with ParseError"
```

---

## Task 4: `uploadCv` Server Action

**Files:**
- Create: `src/app/prep/new/cv-actions.ts`

- [ ] **Step 4.1: Write the Server Action**

`src/app/prep/new/cv-actions.ts`:

```typescript
"use server";

import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import {
  parseCvFile,
  ParseError,
  ACCEPTED_MIME_TYPES,
} from "@/lib/files/parse";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const BUCKET = "cvs";

export type UploadCvState = {
  error?: string;
  cv?: { id: string; file_name: string };
};

export async function uploadCv(
  _prev: UploadCvState,
  formData: FormData,
): Promise<UploadCvState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to upload." };
  }
  if (file.size > MAX_SIZE_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return { error: `Max 5 MB. This file is ${mb} MB.` };
  }
  if (!ACCEPTED_MIME_TYPES.includes(file.type as typeof ACCEPTED_MIME_TYPES[number])) {
    return { error: "Only PDF, DOCX, or TXT files are supported." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let parsedText: string;
  try {
    const result = await parseCvFile(buffer, file.type);
    parsedText = result.text;
  } catch (err) {
    if (err instanceof ParseError) return { error: err.message };
    console.error("[uploadCv] parse error:", err);
    return { error: "Couldn't read this file. Try a different one." };
  }

  const cvId = randomUUID();
  const ext = extFromMime(file.type);
  const path = `${user.id}/${cvId}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false });
  if (uploadErr) {
    console.error("[uploadCv] storage upload failed:", uploadErr);
    return { error: "Upload failed. Please retry." };
  }

  const { error: insertErr } = await supabase.from("cvs").insert({
    id: cvId,
    user_id: user.id,
    file_name: file.name,
    file_path: path,
    file_size_bytes: file.size,
    mime_type: file.type,
    parsed_text: parsedText,
  });

  if (insertErr) {
    console.error("[uploadCv] DB insert failed:", insertErr);
    // Best-effort rollback of storage object.
    await supabase.storage.from(BUCKET).remove([path]);
    return { error: "Couldn't save your CV. Please retry." };
  }

  return { cv: { id: cvId, file_name: file.name } };
}

function extFromMime(mime: string): "pdf" | "docx" | "txt" {
  if (mime === "application/pdf") return "pdf";
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    return "docx";
  return "txt";
}
```

- [ ] **Step 4.2: Type check**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 4.3: Commit**

```bash
git add src/app/prep/new/cv-actions.ts
git commit -m "feat(prep,2b): uploadCv Server Action — validate, parse, store"
```

---

## Task 5: `CvPicker` client component

**Files:**
- Create: `src/components/prep/CvPicker.tsx`

- [ ] **Step 5.1: Implement the component**

`src/components/prep/CvPicker.tsx`:

```typescript
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
```

- [ ] **Step 5.2: Type check**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 5.3: Commit**

```bash
git add src/components/prep/CvPicker.tsx
git commit -m "feat(prep,2b): CvPicker component (select/upload/paste modes)"
```

---

## Task 6: Update `createPrep` schema + flow (TDD)

**Files:**
- Modify: `src/app/prep/new/actions.ts`
- Create: `src/app/prep/new/actions.test.ts`

- [ ] **Step 6.1: Write the failing schema test**

`src/app/prep/new/actions.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { createPrepInputSchema } from "./actions";

const base = {
  jobTitle: "Senior Director",
  companyName: "Acme",
  jobDescription: "x".repeat(300),
};

describe("createPrepInputSchema", () => {
  it("accepts cvId only", () => {
    const result = createPrepInputSchema.safeParse({
      ...base,
      cvId: "11111111-1111-1111-1111-111111111111",
    });
    expect(result.success).toBe(true);
  });

  it("accepts cvText only", () => {
    const result = createPrepInputSchema.safeParse({
      ...base,
      cvText: "x".repeat(300),
    });
    expect(result.success).toBe(true);
  });

  it("rejects both cvId and cvText", () => {
    const result = createPrepInputSchema.safeParse({
      ...base,
      cvId: "11111111-1111-1111-1111-111111111111",
      cvText: "x".repeat(300),
    });
    expect(result.success).toBe(false);
  });

  it("rejects neither cvId nor cvText", () => {
    const result = createPrepInputSchema.safeParse(base);
    expect(result.success).toBe(false);
  });

  it("rejects invalid cvId uuid", () => {
    const result = createPrepInputSchema.safeParse({ ...base, cvId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 6.2: Run the test — expect failure**

```bash
pnpm test src/app/prep/new/actions.test.ts
```

Expected: fails with "createPrepInputSchema is not exported".

- [ ] **Step 6.3: Update `actions.ts`**

Replace `src/app/prep/new/actions.ts` with:

```typescript
"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const createPrepInputSchema = z
  .object({
    jobTitle: z.string().min(2, "Job title is required").max(120),
    companyName: z.string().min(2, "Company name is required").max(120),
    jobDescription: z
      .string()
      .min(200, "Paste a longer job description — at least 200 characters"),
    cvId: z.string().uuid().optional(),
    cvText: z.string().min(200).optional(),
  })
  .refine(
    (d) => Boolean(d.cvId) !== Boolean(d.cvText),
    "Provide a CV (upload/select or paste — not both)",
  );

export type CreatePrepState = { error?: string };

export async function createPrep(
  _prev: CreatePrepState,
  formData: FormData,
): Promise<CreatePrepState> {
  const parsed = createPrepInputSchema.safeParse({
    jobTitle: formData.get("jobTitle"),
    companyName: formData.get("companyName"),
    jobDescription: formData.get("jobDescription"),
    cvId: formData.get("cvId") || undefined,
    cvText: formData.get("cvText") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in to create a prep." };

  let cv_text: string;
  let cv_id: string | null = null;

  if (parsed.data.cvId) {
    const { data: cv, error: cvErr } = await supabase
      .from("cvs")
      .select("id, parsed_text")
      .eq("id", parsed.data.cvId)
      .eq("user_id", user.id)
      .single();
    if (cvErr || !cv) {
      return { error: "CV not found. Upload or paste one." };
    }
    cv_text = cv.parsed_text;
    cv_id = cv.id;
  } else {
    cv_text = parsed.data.cvText!;
  }

  const { data: session, error: insertError } = await supabase
    .from("prep_sessions")
    .insert({
      user_id: user.id,
      job_title: parsed.data.jobTitle,
      company_name: parsed.data.companyName,
      cv_text,
      cv_id,
      job_description: parsed.data.jobDescription,
      generation_status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !session) {
    console.error("[createPrep] insert failed:", insertError);
    return { error: "Could not save your prep session. Please try again." };
  }

  await runGenerationInline(session.id);
  redirect(`/prep/${session.id}`);
}

async function runGenerationInline(sessionId: string) {
  const { runGeneration } = await import("./generation");
  await runGeneration(sessionId);
}

export async function retryPrep(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: session, error } = await supabase
    .from("prep_sessions")
    .select("id, user_id, generation_status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !session) redirect("/dashboard");
  if (session.generation_status === "complete") redirect(`/prep/${id}`);

  await supabase
    .from("prep_sessions")
    .update({
      generation_status: "pending",
      error_message: null,
      prep_guide: null,
    })
    .eq("id", id);

  await runGenerationInline(id);

  redirect(`/prep/${id}`);
}

export async function deleteFailedPrep(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("prep_sessions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  redirect("/prep/new");
}
```

- [ ] **Step 6.4: Run tests — expect pass**

```bash
pnpm test src/app/prep/new/actions.test.ts
```

Expected: 5 passing.

- [ ] **Step 6.5: Commit**

```bash
git add src/app/prep/new/actions.ts src/app/prep/new/actions.test.ts
git commit -m "feat(prep,2b): createPrep accepts cvId XOR cvText; ownership check"
```

---

## Task 7: Integrate `CvPicker` into `/prep/new` (updates existing E2E)

**Files:**
- Modify: `src/app/prep/new/page.tsx`
- Modify: `src/components/prep/NewPrepForm.tsx`
- Modify: `tests/e2e/prep.spec.ts`

- [ ] **Step 7.1: Update the page to fetch CVs**

Replace `src/app/prep/new/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NewPrepForm } from "@/components/prep/NewPrepForm";

export default async function NewPrepPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: cvs } = await supabase
    .from("cvs")
    .select("id, file_name, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8">
        <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-zinc-100">
          ← Back to dashboard
        </Link>
      </div>

      <h1 className="text-3xl font-semibold">Create a prep guide</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Upload your CV and paste the job description. Takes about 30 seconds.
      </p>

      <div className="mt-10">
        <NewPrepForm existingCvs={cvs ?? []} />
      </div>
    </main>
  );
}
```

- [ ] **Step 7.2: Update `NewPrepForm`**

Replace `src/components/prep/NewPrepForm.tsx`:

```typescript
"use client";

import { useActionState, useCallback, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createPrep, type CreatePrepState } from "@/app/prep/new/actions";
import { CvPicker, type CvSummary } from "./CvPicker";

export function NewPrepForm({ existingCvs }: { existingCvs: CvSummary[] }) {
  const [state, formAction, pending] = useActionState<CreatePrepState, FormData>(
    createPrep,
    {},
  );

  const [cvId, setCvId] = useState<string | null>(
    existingCvs[0]?.id ?? null,
  );
  const [cvText, setCvText] = useState<string | null>(null);

  const onResolved = useCallback(
    (v: { cvId: string | null; cvText: string | null }) => {
      setCvId(v.cvId);
      setCvText(v.cvText);
    },
    [],
  );

  const canSubmit = Boolean(cvId) || Boolean(cvText);

  return (
    <>
      {pending && <GeneratingOverlay />}

      <form action={formAction} className="space-y-6">
        <fieldset disabled={pending} className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="companyName" className="block text-sm text-zinc-300">
                Company
              </label>
              <Input id="companyName" name="companyName" placeholder="Acme Corp" required className="mt-1" />
            </div>
            <div>
              <label htmlFor="jobTitle" className="block text-sm text-zinc-300">
                Role
              </label>
              <Input
                id="jobTitle"
                name="jobTitle"
                placeholder="Senior Director, AI Procurement"
                required
                className="mt-1"
              />
            </div>
          </div>

          <CvPicker existingCvs={existingCvs} onResolved={onResolved} />
          {cvId && <input type="hidden" name="cvId" value={cvId} />}
          {cvText && <input type="hidden" name="cvText" value={cvText} />}

          <div>
            <label htmlFor="jobDescription" className="block text-sm text-zinc-300">
              Job Description (paste text)
            </label>
            <textarea
              id="jobDescription"
              name="jobDescription"
              rows={12}
              required
              minLength={200}
              placeholder="Paste the full job description here."
              className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-60"
            />
          </div>
        </fieldset>

        {state.error && !pending && (
          <p className="text-sm text-red-400" role="alert">
            {state.error}
          </p>
        )}

        <Button type="submit" disabled={pending || !canSubmit} className="w-full">
          {pending ? (
            <>
              <Spinner />
              <span className="ml-2">Generating your prep… about 30 seconds</span>
            </>
          ) : (
            "Generate prep guide"
          )}
        </Button>

        {pending && (
          <p className="text-center text-xs text-zinc-500">
            You can stay on this page. We&apos;ll redirect you when it&apos;s ready.
          </p>
        )}
      </form>
    </>
  );
}

function GeneratingOverlay() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm"
    >
      <div className="flex max-w-sm flex-col items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center shadow-xl">
        <Spinner large />
        <div>
          <p className="text-base font-medium text-zinc-100">Generating your prep guide</p>
          <p className="mt-2 text-sm text-zinc-400">
            Analyzing your CV and the job description. About 30 seconds.
          </p>
        </div>
      </div>
    </div>
  );
}

function Spinner({ large = false }: { large?: boolean }) {
  const size = large ? "h-8 w-8" : "h-4 w-4";
  return (
    <svg className={`${size} animate-spin text-brand`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
```

- [ ] **Step 7.3: Update existing `prep.spec.ts` to click "Paste text instead"**

Replace the CV-fill line in `tests/e2e/prep.spec.ts`. Find:

```typescript
  await page.getByLabel("Your CV (paste text)").fill(CV_TEXT);
```

Replace with:

```typescript
  await page.getByRole("button", { name: /paste text instead/i }).click();
  await page.getByLabel("Paste your CV text").fill(CV_TEXT);
```

- [ ] **Step 7.4: Type check + build**

```bash
pnpm typecheck && pnpm build
```

Expected: both succeed.

- [ ] **Step 7.5: Commit**

```bash
git add src/app/prep/new/page.tsx src/components/prep/NewPrepForm.tsx tests/e2e/prep.spec.ts
git commit -m "feat(prep,2b): /prep/new uses CvPicker; update paste-mode e2e"
```

---

## Task 8: Upload E2E tests

**Files:**
- Create: `tests/e2e/upload.spec.ts`

- [ ] **Step 8.1: Write the E2E tests**

`tests/e2e/upload.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";

const CV_BODY =
  "Rodrigo Costa — 10 years in procurement leadership. " +
  "Led $500M addressable spend rollout of e-sourcing platform across 12 LATAM countries. " +
  "Delivered 18% cost takeout and 40% cycle-time reduction over 24 months. " +
  "Digital procurement transformation at Bayer 2019-2022. MBA Insead 2018. " +
  "Private Equity portfolio CFO advisor 2022-present.";

const JD_TEXT =
  "Senior Director, AI & Digital Procurement Transformation. " +
  "Hexion is a $3B specialty chemicals company, sponsor-owned. " +
  "You will design and deploy agentic AI sourcing capability across $300M+ addressable spend. " +
  "Responsibilities include: build the target operating model, stand up an AI Center of Excellence, " +
  "deploy AI Sourcing Agents for autonomous negotiation on tail spend, and drive touchless P2P. " +
  "Qualifications: 10+ years procurement transformation, hands-on AI deployment, PE experience preferred.";

async function makePdfBuffer(text: string): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([600, 800]);
  page.drawText(text, { x: 40, y: 760, size: 10, font, maxWidth: 520, lineHeight: 14 });
  return Buffer.from(await pdf.save());
}

async function makeEmptyPdfBuffer(): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.addPage([600, 800]);
  return Buffer.from(await pdf.save());
}

async function signup(page: import("@playwright/test").Page) {
  const email = `e2e-upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("E2E Upload Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("testpassword123");
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
  return email;
}

test("upload PDF, create prep, reuse CV on second prep", async ({ page }) => {
  await signup(page);
  await page.getByRole("link", { name: /new prep/i }).first().click();
  await page.waitForURL("**/prep/new");

  const pdfBuffer = await makePdfBuffer(CV_BODY);

  await page.getByLabel("Company").fill("Hexion");
  await page.getByLabel("Role").fill("Senior Director, AI Procurement");

  await page.setInputFiles('input[type="file"]', {
    name: "rodrigo-cv.pdf",
    mimeType: "application/pdf",
    buffer: pdfBuffer,
  });
  await expect(page.getByText(/Uploaded: rodrigo-cv\.pdf/)).toBeVisible({ timeout: 15_000 });

  await page.getByLabel("Job Description (paste text)").fill(JD_TEXT);
  await page.getByRole("button", { name: /generate prep guide/i }).click();

  await page.waitForURL("**/prep/**", { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: /Prep for Hexion/i })).toBeVisible({ timeout: 10_000 });

  // Second prep — reuse the uploaded CV
  await page.goto("/prep/new");
  await expect(page.getByText("rodrigo-cv.pdf")).toBeVisible();
  await page.getByLabel("Company").fill("BASF");
  await page.getByLabel("Role").fill("Director, Procurement");
  await page.getByLabel("Job Description (paste text)").fill(JD_TEXT);
  await page.getByRole("button", { name: /generate prep guide/i }).click();
  await page.waitForURL("**/prep/**", { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: /Prep for BASF/i })).toBeVisible({ timeout: 10_000 });
});

test("paste fallback still works", async ({ page }) => {
  await signup(page);
  await page.goto("/prep/new");

  await page.getByLabel("Company").fill("Acme");
  await page.getByLabel("Role").fill("Director");
  await page.getByRole("button", { name: /paste text instead/i }).click();
  await page.getByLabel("Paste your CV text").fill(CV_BODY);
  await page.getByLabel("Job Description (paste text)").fill(JD_TEXT);
  await page.getByRole("button", { name: /generate prep guide/i }).click();

  await page.waitForURL("**/prep/**", { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: /Prep for Acme/i })).toBeVisible({ timeout: 10_000 });
});

test("empty PDF is rejected with a helpful message", async ({ page }) => {
  await signup(page);
  await page.goto("/prep/new");

  const emptyPdf = await makeEmptyPdfBuffer();

  await page.setInputFiles('input[type="file"]', {
    name: "scanned.pdf",
    mimeType: "application/pdf",
    buffer: emptyPdf,
  });

  await expect(
    page.getByText(/couldn't extract enough text/i),
  ).toBeVisible({ timeout: 10_000 });
});
```

- [ ] **Step 8.2: Run E2E locally**

```bash
pnpm build
pnpm test:e2e tests/e2e/upload.spec.ts
```

Expected: all 3 tests pass. If it flakes on the waitForURL because generation takes longer than 20s, bump the timeout to 40_000.

- [ ] **Step 8.3: Run full E2E suite to ensure nothing regressed**

```bash
pnpm test:e2e
```

Expected: all existing specs still pass (auth.spec, prep.spec, ats.spec, upload.spec).

- [ ] **Step 8.4: Commit**

```bash
git add tests/e2e/upload.spec.ts
git commit -m "test(e2e,2b): upload, reuse, paste fallback, parse failure"
```

---

## Task 9: Deployment notes + PR

**Files:**
- Modify: `README.md` (or create `supabase/migrations/README.md` if none)

- [ ] **Step 9.1: Document the manual deploy steps**

Check for an existing `README.md`. If it has a "Migrations" or "Deploy" section, append to it. Otherwise create `supabase/migrations/README.md`:

```markdown
# Migrations

Applied manually via Supabase Dashboard → SQL Editor after each merge to `main`.

| # | File | Applied on |
|---|---|---|
| 0001 | `0001_initial.sql` | 2026-04-20 |
| 0002 | `0002_prep_sessions.sql` | 2026-04-21 |
| 0004 | `0004_ats_analysis.sql` | 2026-04-21 |
| 0005 | `0005_cvs.sql` | pending |

## 0005 deploy steps

1. Run `0005_cvs.sql` in SQL Editor.
2. In Supabase Dashboard → Storage, create a new **private** bucket named `cvs`.
3. Run `0005_cvs_storage_policies.sql` in SQL Editor.
4. Verify: upload a CV on the live app, check `cvs` table has a row and the file is visible in the bucket under `{user_id}/{cv_id}.{ext}`.
```

- [ ] **Step 9.2: Commit**

```bash
git add supabase/migrations/README.md
git commit -m "docs(2b): migration 0005 deploy steps"
```

- [ ] **Step 9.3: Run full local gate before pushing**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Expected: all green.

- [ ] **Step 9.4: Push and open PR**

```bash
git push -u origin file-upload/2b
gh pr create --title "feat: CV file upload (#2b)" --body "$(cat <<'EOF'
## Summary
Replaces the CV textarea on /prep/new with PDF/DOCX/TXT upload. Parses server-side, caches in new \`cvs\` table, lets users pick previously-uploaded CVs. Paste textarea preserved as fallback for problem files.

Spec: \`docs/superpowers/specs/2026-04-21-file-upload-design.md\`
Plan: \`docs/superpowers/plans/2026-04-21-file-upload.md\`

## Deploy checklist (post-merge)
- [ ] Run \`supabase/migrations/0005_cvs.sql\` in SQL Editor
- [ ] Create private bucket \`cvs\` in Supabase Storage UI
- [ ] Run \`supabase/migrations/0005_cvs_storage_policies.sql\` in SQL Editor
- [ ] Smoke test: upload a real PDF CV, verify prep generates

## Test plan
- [x] \`pnpm typecheck\` — clean
- [x] \`pnpm test\` — parser, schema, all previous suites green
- [x] \`pnpm build\` — production build succeeds
- [x] \`pnpm test:e2e\` — upload/reuse/paste/parse-failure + regression suite
- [ ] Smoke test on Railway

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 9.5: Wait for CI**

```bash
gh pr checks --watch
```

Expected: `test` check passes.

- [ ] **Step 9.6: Merge (user confirms)**

Do NOT auto-merge. Ask the user to review the PR first, then merge with:

```bash
gh pr merge --squash --delete-branch
```

Follow with deployment checklist in Supabase Dashboard.

---

## Done Criteria (from spec §13)

- [ ] Migration 0005 + storage policies applied on Supabase, bucket `cvs` exists
- [ ] User can upload PDF/DOCX/TXT ≤ 5 MB from `/prep/new`
- [ ] User can pick a previously-uploaded CV from a radio list
- [ ] User can still paste CV text via a fallback link
- [ ] Empty/scanned PDF is rejected with a clear message
- [ ] `prep_sessions.cv_id` populated when file-based; `null` when pasted
- [ ] `pnpm typecheck`, `pnpm test`, `pnpm build` all pass
- [ ] Playwright upload E2E passes in CI with `MOCK_ANTHROPIC=1`
- [ ] Smoke tested on Railway with a real PDF
