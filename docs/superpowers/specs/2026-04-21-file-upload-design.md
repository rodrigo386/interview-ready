# Sub-project #2b — CV File Upload (PDF/DOCX/TXT)

**Status:** Design approved 2026-04-21
**Depends on:** #1 Foundation, #2a Core Pipeline (v2 + 5-sections)
**Replaces:** `/prep/new` textarea-only CV input

---

## 1. Goal

Replace the "paste CV text" textarea on `/prep/new` with a file upload that extracts text from PDF, DOCX, or TXT, caches the parsed text for reuse across preps, and keeps a paste-text escape hatch for problem files.

Users who have uploaded a CV before can pick it from a list instead of re-uploading.

---

## 2. Non-goals

- Dedicated CV management page (list / rename / delete UI beyond the selection list on `/prep/new`)
- OCR for scanned / image-based PDFs (treated as parse failure)
- Re-parsing stored CVs when the parser improves
- CV preview / thumbnail
- Multiple CVs per prep session
- File version history
- Virus scanning / content moderation

---

## 3. Schema

### Migration `0005_cvs.sql`

```sql
CREATE TABLE public.cvs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,            -- original filename for display
  file_path TEXT NOT NULL,            -- storage path: {user_id}/{id}.{ext}
  file_size_bytes INT NOT NULL,
  mime_type TEXT NOT NULL,
  parsed_text TEXT NOT NULL,          -- cached extracted text
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

### Storage bucket

Bucket name: **`cvs`**, private.

Storage RLS policies (applied via Supabase dashboard SQL Editor after migration):

```sql
CREATE POLICY "users can upload to own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'cvs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "users can read own files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'cvs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "users can delete own files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'cvs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

Path convention: `{user_id}/{cv_row_id}.{pdf|docx|txt}`.

`prep_sessions.cv_text` stays `NOT NULL`. On create, copy `cvs.parsed_text` into it. This keeps `runGeneration` (and all downstream code) untouched.

---

## 4. File parsing module

`src/lib/files/parse.ts`

```ts
export type ParsedCV = { text: string; pageCount?: number };

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

export async function parseCvFile(
  buffer: Buffer,
  mimeType: string,
): Promise<ParsedCV>;
```

**Accepted mime types:**

- `application/pdf` — parsed with `pdf-parse` → returns `{ text, numpages }`
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document` — parsed with `mammoth.extractRawText({ buffer })` → returns `{ value }`
- `text/plain` — parsed with `buffer.toString("utf8")`

**Post-processing (common to all):**

1. Replace `\r\n` with `\n`
2. Collapse 3+ consecutive newlines to 2
3. Trim leading/trailing whitespace
4. Reject with `ParseError("We couldn't extract enough text from this file. It may be a scanned image. Try pasting the text instead.")` if `text.length < 200`

**Tests (Vitest, `src/lib/files/parse.test.ts`):**

- `fixtures/sample.pdf` (~50 words) → returns text with `length >= 200` when the sample has enough content; else use a longer fixture
- `fixtures/sample.docx` → returns text
- `fixtures/sample.txt` → returns text
- `fixtures/empty.pdf` (text-free / image-only) → throws `ParseError`
- Invalid mime type → throws
- Fixtures committed to `src/lib/files/fixtures/`

---

## 5. Upload Server Action

File: `src/app/prep/new/cv-actions.ts`

```ts
"use server";

export type UploadCvState = {
  error?: string;
  cv?: { id: string; file_name: string };
};

export async function uploadCv(
  _prev: UploadCvState,
  formData: FormData,
): Promise<UploadCvState>;
```

**Flow:**

1. Auth check. If no user, return `{ error: "You must be signed in." }`.
2. Extract `file` from FormData. Validate:
   - `file.size > 0 && file.size <= 5_242_880` (5 MB)
   - `file.type` is one of the three accepted mimes
3. Read buffer: `const buffer = Buffer.from(await file.arrayBuffer())`
4. Parse → `{ text }`. `ParseError` → return `{ error: err.message }`.
5. `const cvId = crypto.randomUUID()`; `const ext = extFromMime(file.type)`; `const path = \`${user.id}/${cvId}.${ext}\``
6. Upload to Storage via authenticated Supabase client (RLS enforces user folder). On failure → return `{ error }`.
7. Insert into `cvs` with `id: cvId, user_id, file_name: file.name, file_path: path, file_size_bytes: file.size, mime_type: file.type, parsed_text: text`.
8. If insert fails, delete the storage object (best-effort rollback), return `{ error }`.
9. Return `{ cv: { id: cvId, file_name: file.name } }`.

**Note:** `MOCK_ANTHROPIC=1` does not affect this action (no Claude call here).

---

## 6. Form UX — `/prep/new`

### Layout (top → bottom)

1. Header (unchanged): "Create a prep guide"
2. Company + Role inputs (unchanged)
3. **CV section (new)** — see below
4. Job Description textarea (unchanged)
5. Submit button (unchanged)

### CV section structure

```
Your CV

[IF user.cvs.length > 0:]
  Use an existing CV:
  ○ resume-2026-04.pdf     · uploaded 3 days ago
  ○ cv-senior-director.docx · uploaded today
  ────── or ──────

[Dropzone]
  Drop your CV here, or click to browse
  PDF, DOCX, or TXT · max 5MB

[Link: "Paste text instead"]
  → expands a textarea (replaces dropzone)
```

### Client state

`NewPrepForm` becomes a more complex client component:

```ts
type CvInputMode = "select" | "upload" | "paste";
type State = {
  mode: CvInputMode;
  selectedCvId: string | null;
  uploadedCv: { id: string; file_name: string } | null;
  pastedText: string;
  uploading: boolean;
  uploadError: string | null;
};
```

- `mode = "select"` by default if user has existing CVs, else `"upload"`.
- Clicking a radio → `mode = "select"`, sets `selectedCvId`.
- Dropping / picking a file → calls `uploadCv` action (via a separate `useActionState`); on success, `mode = "upload"`, `uploadedCv = { id, file_name }`.
- "Paste text instead" link → `mode = "paste"`.
- On submit:
  - `mode === "select"` → form posts `cvId: selectedCvId`
  - `mode === "upload"` → form posts `cvId: uploadedCv.id`
  - `mode === "paste"` → form posts `cvText: pastedText`

Dropzone lib: **none** (native `<input type="file">` + drag/drop handlers). Avoids adding `react-dropzone`.

### Fetching existing CVs

Server component `/prep/new/page.tsx` runs:

```ts
const { data: cvs } = await supabase
  .from("cvs")
  .select("id, file_name, created_at")
  .eq("user_id", user.id)
  .order("created_at", { ascending: false })
  .limit(10);
```

Passes `cvs` prop to `NewPrepForm`.

---

## 7. `createPrep` Server Action — updated

File: `src/app/prep/new/actions.ts`

New schema:

```ts
const formSchema = z
  .object({
    jobTitle: z.string().min(2).max(120),
    companyName: z.string().min(2).max(120),
    jobDescription: z.string().min(200),
    cvId: z.string().uuid().optional(),
    cvText: z.string().min(200).optional(),
  })
  .refine(
    (d) => Boolean(d.cvId) !== Boolean(d.cvText),
    "Provide a CV (upload/select or paste — not both)",
  );
```

**Flow change:**

- If `cvId`:
  - Fetch `cvs.parsed_text` with `.eq("id", cvId).eq("user_id", user.id).single()`
  - If not found → error
  - Insert `prep_sessions` with `cv_text = cv.parsed_text`, `cv_id = cvId`
- If `cvText`:
  - Insert `prep_sessions` with `cv_text = cvText`, `cv_id = null` (paste fallback)
- Everything after insert (runGeneration, redirect) unchanged.

---

## 8. Error handling matrix

| Failure | Where | UX |
|---|---|---|
| No file selected | Client | Button disabled until file OR paste OR selection |
| File > 5 MB | Client validation + action | "Max 5 MB. This file is X MB." |
| Wrong mime type | Client validation + action | "Only PDF, DOCX, or TXT files are supported." |
| Parser throws (<200 chars) | `uploadCv` | Show error next to dropzone, suggest paste |
| Storage upload fails | `uploadCv` | Generic retry error |
| DB insert fails after storage upload | `uploadCv` | Best-effort delete storage object, generic retry |
| `createPrep` missing both cvId and cvText | `createPrep` | "Provide a CV" |
| `cvId` not found / not owned | `createPrep` | "CV not found. Upload or paste one." |
| Claude generation fails | `runGeneration` | Unchanged — existing `PrepFailed` path |

---

## 9. Dependencies

Production:
- `pdf-parse` (~2 MB bundled, pinned; known quirky ESM story — import with `import pdf from "pdf-parse/lib/pdf-parse.js"` to avoid the package's debug test code running at import time)
- `mammoth` (~500 KB)

Dev:
- `@types/pdf-parse` (if it exists; `mammoth` ships its own types)

---

## 10. Testing plan

### Unit (`vitest`)

- `src/lib/files/parse.test.ts` — PDF/DOCX/TXT fixtures + empty-PDF throw case (5 tests)
- `src/app/prep/new/actions.test.ts` — schema refine test: cvId XOR cvText (2 cases)

### E2E (`playwright`, `tests/e2e/upload.spec.ts`)

Environment: `MOCK_ANTHROPIC=1`.

Scenarios:
1. **Upload and create:** signup → `/prep/new` → upload `sample.pdf` → fill other fields → submit → redirects to `/prep/[id]` with status=complete.
2. **Reuse existing CV:** after scenario 1, revisit `/prep/new` → existing CV appears → select it → submit → second prep created.
3. **Paste fallback:** click "Paste text instead" → paste 500 chars → submit → prep created with `cv_id = null`.
4. **Parse failure:** upload `empty.pdf` → error message shown, no prep created.

### Manual smoke on Railway

After deploy, upload a real ~200KB PDF CV → confirm prep generates normally.

---

## 11. Migration deploy steps

1. Merge PR → Railway auto-deploys code.
2. Manually run `0005_cvs.sql` in Supabase Dashboard SQL Editor (current convention — see status snapshot).
3. Create bucket `cvs` (private) in Supabase Storage UI, then run the three storage RLS policies from §3 in SQL Editor.
4. Verify on live: upload a CV, create a prep.

---

## 12. Files touched

**New:**
- `supabase/migrations/0005_cvs.sql`
- `src/lib/files/parse.ts`
- `src/lib/files/parse.test.ts`
- `src/lib/files/fixtures/sample.pdf`
- `src/lib/files/fixtures/sample.docx`
- `src/lib/files/fixtures/sample.txt`
- `src/lib/files/fixtures/empty.pdf`
- `src/app/prep/new/cv-actions.ts`
- `src/components/prep/CvPicker.tsx` (the upload/select/paste sub-component)
- `tests/e2e/upload.spec.ts`

**Modified:**
- `src/app/prep/new/page.tsx` (fetch CVs, pass to form)
- `src/app/prep/new/actions.ts` (new schema + cvId path)
- `src/components/prep/NewPrepForm.tsx` (integrate CvPicker)
- `package.json` (add deps)

**Unchanged:**
- `runGeneration`, Anthropic integration, schema validators, ATS flow

---

## 13. Done criteria

- [ ] Migration applied on Supabase, bucket `cvs` exists with RLS
- [ ] User can upload PDF/DOCX/TXT ≤ 5 MB from `/prep/new`
- [ ] User can pick a previously-uploaded CV from a radio list
- [ ] User can still paste CV text via a fallback link
- [ ] Empty/scanned PDF is rejected with a clear message
- [ ] `prep_sessions.cv_id` populated when file-based; `null` when pasted
- [ ] `pnpm typecheck`, `pnpm test`, `pnpm build` all pass
- [ ] Playwright upload E2E passes in CI with `MOCK_ANTHROPIC=1`
- [ ] Smoke tested on Railway with a real PDF
