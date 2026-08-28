import { describe, expect, it } from "vitest";

import {
  ALLOWED_CONTENT_TYPES,
  ATTACHMENT_ACCEPT,
  MAX_ATTACHMENT_BYTES,
  validateAttachment,
} from "@/api/attachments";

/**
 * These limits are transcribed from `backend/apps/tickets/views.py`. This file
 * cannot import Python, so it pins the shape and a representative sample —
 * enough that an edit on one side without the other fails here rather than in
 * a confusing 400 at upload time.
 */

const file = (type: string, size = 1024) => {
  const handle = new File(["x"], "sample", { type });
  Object.defineProperty(handle, "size", { value: size });
  return handle;
};

describe("attachment limits mirror the backend", () => {
  it("keeps the 10 MB cap", () => {
    expect(MAX_ATTACHMENT_BYTES).toBe(10 * 1024 * 1024);
  });

  it("keeps all sixteen accepted content types", () => {
    expect(ALLOWED_CONTENT_TYPES).toHaveLength(16);
    // A sample across the families the backend lists: documents, images,
    // plain text, the OOXML pair and OpenDocument.
    for (const type of [
      "application/pdf",
      "image/png",
      "text/csv",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.oasis.opendocument.spreadsheet",
    ]) {
      expect(ALLOWED_CONTENT_TYPES).toContain(type);
    }
  });

  it("offers the same list to the file picker", () => {
    expect(ATTACHMENT_ACCEPT.split(",")).toEqual([...ALLOWED_CONTENT_TYPES]);
  });
});

describe("validateAttachment", () => {
  it("accepts an allowed type under the limit", () => {
    expect(validateAttachment(file("application/pdf"))).toEqual({ ok: true });
  });

  it("rejects one byte over the limit", () => {
    const verdict = validateAttachment(file("application/pdf", MAX_ATTACHMENT_BYTES + 1));
    expect(verdict).toEqual({ ok: false, reason: "too_large", limitMb: 10 });
  });

  it("accepts exactly the limit — the backend's check is `>`, not `>=`", () => {
    expect(validateAttachment(file("application/pdf", MAX_ATTACHMENT_BYTES))).toEqual({
      ok: true,
    });
  });

  it("rejects a type the backend does not accept", () => {
    expect(validateAttachment(file("application/x-msdownload"))).toMatchObject({
      ok: false,
      reason: "wrong_type",
    });
  });

  it("strips parameters and case, as the server does", () => {
    // The browser can report `text/csv; charset=utf-8`; the server splits on
    // ";" and lowercases before comparing, so this must too.
    expect(validateAttachment(file("TEXT/CSV; charset=utf-8"))).toEqual({ ok: true });
  });

  it("reports an empty type as unknown rather than crashing", () => {
    expect(validateAttachment(file(""))).toEqual({
      ok: false,
      reason: "wrong_type",
      type: "unknown",
    });
  });
});
