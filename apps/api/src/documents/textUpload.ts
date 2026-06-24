import {
  allowedUploadExtensions,
  allowedTextUploadExtensions,
  allowedTextUploadMediaTypes,
  maxUploadBytes,
  maxUploadCharacters,
  maxUploadFilenameLength,
  type DocumentUploadRequest
} from "@client-review-prep/shared";
import { Buffer } from "node:buffer";

export class DocumentUploadError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

const hasControlCharacter = (value: string) =>
  Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint < 32 || codePoint === 127;
  });

const basename = (filename: string) =>
  filename.replace(/\\/g, "/").split("/").filter(Boolean).at(-1) ?? "";

export const sanitizeUploadFilename = (
  filename: string,
  allowedExtensions: readonly string[] = allowedUploadExtensions
) => {
  if (hasControlCharacter(filename)) {
    throw new DocumentUploadError("UNSAFE_FILENAME");
  }

  if (filename.replace(/\\/g, "/").split("/").includes("..")) {
    throw new DocumentUploadError("UNSAFE_FILENAME");
  }

  const safeFilename = basename(filename).trim();

  if (
    !safeFilename ||
    safeFilename.includes("..") ||
    /^[a-zA-Z]:/.test(safeFilename) ||
    safeFilename.length > maxUploadFilenameLength
  ) {
    throw new DocumentUploadError("UNSAFE_FILENAME");
  }

  const lower = safeFilename.toLowerCase();
  const extension = allowedExtensions.find((candidate) =>
    lower.endsWith(candidate)
  );

  if (!extension) {
    throw new DocumentUploadError("UNSUPPORTED_EXTENSION");
  }

  return { safeFilename, extension };
};

export const normalizeUploadMediaType = (mediaType: string) =>
  mediaType.toLowerCase().split(";")[0]?.trim() ?? "";

export const validateUploadMediaType = <TMediaTypes extends readonly string[]>(
  mediaType: string,
  allowedMediaTypes: TMediaTypes
): TMediaTypes[number] => {
  const normalized = normalizeUploadMediaType(mediaType);
  for (const candidate of allowedMediaTypes) {
    if (candidate === normalized) {
      return candidate;
    }
  }

  throw new DocumentUploadError("UNSUPPORTED_MEDIA_TYPE");
};

export const validateUploadText = (
  input: { text: string; sizeBytes: number }
) => {
  const normalizedText = input.text.replace(/\r\n?/g, "\n");
  const byteCount = Buffer.byteLength(normalizedText, "utf8");

  if (normalizedText.length > maxUploadCharacters) {
    throw new DocumentUploadError("FILE_TOO_LARGE");
  }

  if (byteCount > maxUploadBytes) {
    throw new DocumentUploadError("FILE_TOO_LARGE");
  }

  if (normalizedText.includes("\uFFFD")) {
    throw new DocumentUploadError("INVALID_UTF8");
  }

  if (normalizedText.trim().length === 0) {
    throw new DocumentUploadError("EMPTY_DOCUMENT");
  }

  return {
    text: normalizedText,
    characterCount: normalizedText.length,
    byteCount
  };
};

export const validateTextUpload = (
  input: Extract<DocumentUploadRequest, { documentType: "TEXT" }>
) => {
  const filename = sanitizeUploadFilename(
    input.originalFilename,
    allowedTextUploadExtensions
  );
  const mediaType = validateUploadMediaType(
    input.mediaType,
    allowedTextUploadMediaTypes
  );
  const content = validateUploadText(input);

  return {
    safeFilename: filename.safeFilename,
    extension: filename.extension,
    mediaType,
    text: content.text,
    characterCount: content.characterCount,
    byteCount: content.byteCount
  };
};
