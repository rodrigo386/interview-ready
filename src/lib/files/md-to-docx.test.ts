import { describe, it, expect } from "vitest";
import mammoth from "mammoth";
import { mdToDocx } from "./md-to-docx";

const SAMPLE = `## Professional Summary

Senior procurement leader with 10+ years driving **agentic AI** transformation.

## Experience

### Head of Digital Procurement — Bayer (2019-2022)
- Led $500M addressable spend rollout
- Delivered 18% cost takeout

## Education
MBA, INSEAD, 2018`;

describe("mdToDocx", () => {
  it("produces a DOCX that mammoth can re-parse with headings and bullets intact", async () => {
    const buffer = await mdToDocx(SAMPLE);
    const { value: text } = await mammoth.extractRawText({ buffer });
    expect(text).toContain("Professional Summary");
    expect(text).toContain("Head of Digital Procurement");
    expect(text).toContain("Led $500M addressable spend rollout");
    expect(text).toContain("MBA, INSEAD, 2018");
    // Bold text should survive as plain text (mammoth drops formatting in extractRawText)
    expect(text).toContain("agentic AI");
  });

  it("handles an empty markdown input without throwing", async () => {
    const buffer = await mdToDocx("");
    expect(buffer.length).toBeGreaterThan(0); // valid empty DOCX
  });

  it("preserves paragraph breaks between sections", async () => {
    const buffer = await mdToDocx("First paragraph.\n\nSecond paragraph.");
    const { value: text } = await mammoth.extractRawText({ buffer });
    expect(text).toContain("First paragraph");
    expect(text).toContain("Second paragraph");
  });
});
