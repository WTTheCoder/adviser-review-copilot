import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import { maxUploadBytes } from "@client-review-prep/shared";
import {
  sanitizeUploadFilename,
  validateTextUpload,
  validateUploadMediaType
} from "./textUpload.js";

const validUpload = {
  clientId: "demo-alex-taylor",
  observedDate: "2026-06-04",
  sourceType: "ADVISER_MEETING_NOTE" as const,
  originalFilename: "meeting-note.txt",
  mediaType: "text/plain",
  sizeBytes: 42,
  documentType: "TEXT" as const,
  text: "Alex may have moved to Fremantle."
};

describe("text upload validation", () => {
  it("accepts valid txt and markdown uploads", () => {
    const validated = validateTextUpload(validUpload);

    expect(validated.safeFilename).toBe("meeting-note.txt");
    expect(validated.byteCount).toBe(Buffer.byteLength(validUpload.text, "utf8"));
    expect(
      validateTextUpload({
        ...validUpload,
        originalFilename: "meeting-note.md",
        mediaType: "text/markdown"
      }).safeFilename
    ).toBe("meeting-note.md");
  });

  it("strips path components from Windows path-like filenames", () => {
    expect(sanitizeUploadFilename("C:\\Users\\Alex\\note.txt").safeFilename).toBe(
      "note.txt"
    );
  });

  it("rejects Unix traversal, null/control characters, long names, and pdfs", () => {
    expect(() => sanitizeUploadFilename("../note.txt")).toThrow();
    expect(() => sanitizeUploadFilename("bad\u0000name.txt")).toThrow();
    expect(() => sanitizeUploadFilename(`${"a".repeat(121)}.txt`)).toThrow();
    expect(() =>
      validateTextUpload({
        ...validUpload,
        originalFilename: "statement.pdf"
      })
    ).toThrow();
  });

  it("rejects unsupported media types", () => {
    expect(() =>
      validateUploadMediaType("application/pdf", [
        "text/plain",
        "text/markdown",
        "text/x-markdown",
        "application/octet-stream"
      ])
    ).toThrow();
  });

  it("rejects oversized, empty, whitespace-only, and invalid UTF-8 text", () => {
    expect(() =>
      validateTextUpload({ ...validUpload, text: "a".repeat(maxUploadBytes + 1) })
    ).toThrow();
    expect(() => validateTextUpload({ ...validUpload, text: "" })).toThrow();
    expect(() => validateTextUpload({ ...validUpload, text: "   \n\t" })).toThrow();
    expect(() => validateTextUpload({ ...validUpload, text: "Bad \uFFFD text" }))
      .toThrow();
  });

  it("accepts ASCII text exactly at the UTF-8 byte limit", () => {
    const text = "a".repeat(maxUploadBytes);
    const validated = validateTextUpload({
      ...validUpload,
      sizeBytes: text.length,
      text
    });

    expect(validated.byteCount).toBe(maxUploadBytes);
    expect(validated.characterCount).toBe(maxUploadBytes);
  });

  it("rejects ASCII text one byte above the UTF-8 byte limit", () => {
    const text = "a".repeat(maxUploadBytes + 1);

    expect(() =>
      validateTextUpload({
        ...validUpload,
        sizeBytes: 1,
        text
      })
    ).toThrow();
  });

  it("rejects multibyte UTF-8 text that exceeds the byte limit below the character limit", () => {
    const text = "\u20ac".repeat(Math.floor(maxUploadBytes / 3) + 1);

    expect(text.length).toBeLessThan(maxUploadBytes);
    expect(Buffer.byteLength(text, "utf8")).toBeGreaterThan(maxUploadBytes);
    expect(() =>
      validateTextUpload({
        ...validUpload,
        sizeBytes: 1,
        text
      })
    ).toThrow();
  });

  it("does not trust forged client size metadata", () => {
    const text = "Accepted text.";

    expect(
      validateTextUpload({
        ...validUpload,
        sizeBytes: 1,
        text
      }).byteCount
    ).toBe(Buffer.byteLength(text, "utf8"));
    expect(
      validateTextUpload({
        ...validUpload,
        sizeBytes: maxUploadBytes + 1,
        text
      }).byteCount
    ).toBe(Buffer.byteLength(text, "utf8"));
  });
});
