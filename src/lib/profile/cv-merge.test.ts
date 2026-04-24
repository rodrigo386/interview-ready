import { describe, expect, it } from "vitest";
import { mergeCvs } from "./cv-merge";

describe("mergeCvs", () => {
  it("retorna lista vazia quando ambas inputs vazias", () => {
    expect(mergeCvs([], [])).toEqual([]);
  });

  it("usa display_name quando presente, senão file_name", () => {
    const result = mergeCvs(
      [
        {
          id: "a",
          file_name: "cv.pdf",
          display_name: "Meu CV principal",
          file_size_bytes: 1024,
          mime_type: "application/pdf",
          created_at: "2026-04-20T10:00:00Z",
        },
        {
          id: "b",
          file_name: "old.pdf",
          display_name: null,
          file_size_bytes: 2048,
          mime_type: "application/pdf",
          created_at: "2026-04-19T10:00:00Z",
        },
      ],
      [],
    );
    expect(result[0]).toMatchObject({ origin: "upload", displayName: "Meu CV principal" });
    expect(result[1]).toMatchObject({ origin: "upload", displayName: "old.pdf" });
  });

  it("filtra rewrites com cv_rewrite_status !== 'complete'", () => {
    const result = mergeCvs(
      [],
      [
        {
          id: "p1",
          company_name: "Acme",
          job_title: "Eng",
          cv_rewrite_status: "complete",
          updated_at: "2026-04-22T10:00:00Z",
        },
        {
          id: "p2",
          company_name: "Beta",
          job_title: "PM",
          cv_rewrite_status: "generating",
          updated_at: "2026-04-23T10:00:00Z",
        },
      ],
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ origin: "ai", prepSessionId: "p1" });
  });

  it("ordena tudo descendente por timestamp (createdAt para upload, updatedAt para ai)", () => {
    const result = mergeCvs(
      [
        {
          id: "u1",
          file_name: "a.pdf",
          display_name: null,
          file_size_bytes: 1,
          mime_type: "application/pdf",
          created_at: "2026-04-20T10:00:00Z",
        },
      ],
      [
        {
          id: "p1",
          company_name: "Acme",
          job_title: "Eng",
          cv_rewrite_status: "complete",
          updated_at: "2026-04-22T10:00:00Z",
        },
      ],
    );
    expect(result[0].origin).toBe("ai");
    expect(result[1].origin).toBe("upload");
  });
});
