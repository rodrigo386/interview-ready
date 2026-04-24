import type { AiRewriteRow, UnifiedCv, UploadedCvRow } from "./types";

export function mergeCvs(
  uploaded: UploadedCvRow[],
  rewrites: AiRewriteRow[],
): UnifiedCv[] {
  const fromUploads: UnifiedCv[] = uploaded.map((row) => ({
    origin: "upload",
    id: row.id,
    displayName: row.display_name?.trim() || row.file_name,
    fileName: row.file_name,
    sizeBytes: row.file_size_bytes,
    mimeType: row.mime_type,
    createdAt: row.created_at,
  }));

  const fromRewrites: UnifiedCv[] = rewrites
    .filter((row) => row.cv_rewrite_status === "complete")
    .map((row) => ({
      origin: "ai",
      prepSessionId: row.id,
      companyName: row.company_name,
      jobTitle: row.job_title,
      updatedAt: row.updated_at,
    }));

  const all = [...fromUploads, ...fromRewrites];
  return all.sort((a, b) => {
    const ta = a.origin === "upload" ? a.createdAt : a.updatedAt;
    const tb = b.origin === "upload" ? b.createdAt : b.updatedAt;
    return tb.localeCompare(ta);
  });
}
