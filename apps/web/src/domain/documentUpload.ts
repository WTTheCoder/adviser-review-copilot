import {
  allowedPdfUploadMediaTypes,
  allowedTextUploadMediaTypes,
  maxPdfUploadBytes,
  maxUploadBytes,
  type DocumentUploadRequest
} from "@client-review-prep/shared";

const extensionOf = (filename: string) => {
  const dotIndex = filename.lastIndexOf(".");
  return dotIndex >= 0 ? filename.slice(dotIndex).toLowerCase() : "";
};

export type UploadFile = Pick<
  File,
  "name" | "type" | "size" | "text" | "arrayBuffer"
>;

export const documentTypeForFile = (file: UploadFile) =>
  extensionOf(file.name) === ".pdf" ? "PDF" : "TEXT";

export const validateSelectedUploadFile = (file: UploadFile) => {
  const extension = extensionOf(file.name);
  if (![".txt", ".md", ".pdf"].includes(extension)) {
    return "Select one .txt, .md, or .pdf file.";
  }

  if (extension === ".pdf") {
    if (file.size > maxPdfUploadBytes) {
      return "The PDF is too large for this local demo.";
    }
    if (
      !allowedPdfUploadMediaTypes.some(
        (mediaType) => mediaType === file.type
      )
    ) {
      return "Select a PDF with the application/pdf media type.";
    }
    return null;
  }

  if (file.size > maxUploadBytes) {
    return "The text file is too large for this local demo.";
  }

  const mediaType = file.type || "application/octet-stream";
  if (
    !allowedTextUploadMediaTypes.some(
      (allowedMediaType) => allowedMediaType === mediaType
    )
  ) {
    return "Select a plain text or Markdown document.";
  }

  return null;
};

const bytesToBase64 = (bytes: Uint8Array) => {
  const chunkSize = 32_768;
  let binary = "";

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }

  return btoa(binary);
};

export const buildDocumentUploadRequest = async (input: {
  clientId: string;
  observedDate: string;
  file: UploadFile;
}): Promise<DocumentUploadRequest> => {
  const common = {
    clientId: input.clientId,
    observedDate: input.observedDate,
    sourceType: "ADVISER_MEETING_NOTE" as const,
    originalFilename: input.file.name,
    mediaType: input.file.type || "application/octet-stream",
    sizeBytes: input.file.size
  };

  if (documentTypeForFile(input.file) === "PDF") {
    return {
      ...common,
      documentType: "PDF",
      mediaType: input.file.type,
      base64Data: bytesToBase64(
        new Uint8Array(await input.file.arrayBuffer())
      )
    };
  }

  return {
    ...common,
    documentType: "TEXT",
    text: await input.file.text()
  };
};

const safePdfErrorMessages: Record<string, string> = {
  PDF_INVALID_SIGNATURE: "The selected file is not a valid PDF.",
  PDF_TOO_LARGE: "The PDF is too large for this local demo.",
  PDF_PARSE_FAILED: "The PDF could not be read. Try another text-based PDF.",
  PDF_ENCRYPTED: "Encrypted PDFs are not supported.",
  PDF_PASSWORD_PROTECTED: "Password-protected PDFs are not supported.",
  PDF_PARSE_TIMEOUT: "The PDF took too long to read. Try another document.",
  PDF_PAGE_LIMIT_EXCEEDED: "The PDF exceeds the 25-page local demo limit.",
  PDF_TEXT_NOT_AVAILABLE:
    "No selectable text was found. OCR for scanned PDFs is not supported yet.",
  PDF_EXTRACTED_TEXT_TOO_LARGE:
    "The extracted PDF text is too large for this local demo.",
  PDF_UNSUPPORTED_FEATURE: "This PDF uses a feature that is not supported."
};

export const uploadErrorMessage = (code: unknown) =>
  typeof code === "string" && safePdfErrorMessages[code]
    ? safePdfErrorMessages[code]
    : "The document could not be uploaded. Check the file type, date, and content.";
