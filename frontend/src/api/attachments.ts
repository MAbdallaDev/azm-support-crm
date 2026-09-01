import { api } from "./client";

/**
 * `AttachmentSerializer`/`PortalAttachmentSerializer` build their `file` URL
 * with no `request` in context (neither `TicketViewSet.attachments` nor the
 * portal's own action passes one), so `FileField` serializes a **root-relative**
 * path (`/media/attachments/...`) — correct against the API's own origin,
 * wrong against the frontend's. A bare `<a href={attachment.file}>` resolves
 * against `window.location`, which is the Vite dev server, not the API.
 */
export const attachmentUrl = (file: string): string => {
  if (/^https?:\/\//i.test(file)) return file;
  const origin = new URL(api.defaults.baseURL ?? "http://localhost:8000/api/v1").origin;
  return `${origin}${file}`;
};

/**
 * Upload limits, mirroring `backend/apps/tickets/views.py`.
 *
 * The point of validating client-side is to fail fast and say why — a 10 MB
 * upload that dies at the server after thirty seconds is a worse experience
 * than an instant "too large". The point of transcribing the **same** numbers
 * is that a client limit looser than the server's turns into a confusing 400,
 * and one tighter silently forbids files the API would have accepted.
 *
 * If either list changes, both change. The two are checked against each other
 * in `attachments.test.ts` — which cannot import Python, so it asserts the
 * count and a representative sample rather than pretending to be authoritative.
 */

/** `MAX_ATTACHMENT_BYTES` — 10 MB. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/**
 * `ALLOWED_CONTENT_TYPES` — all sixteen entries, in the backend's order.
 *
 * (Story 07's plan calls this an "eighteen-entry" set; the set in
 * `views.py` has sixteen. The code is the authority, and
 * `attachments.test.ts` pins the count so a future edit to either side
 * fails here rather than at upload time.)
 */
export const ALLOWED_CONTENT_TYPES: readonly string[] = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "text/csv",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation",
];

/** The `accept` attribute for the file input, so the picker filters too. */
export const ATTACHMENT_ACCEPT = ALLOWED_CONTENT_TYPES.join(",");

export type AttachmentRejection =
  | { ok: true }
  | { ok: false; reason: "too_large"; limitMb: number }
  | { ok: false; reason: "wrong_type"; type: string };

/**
 * The same two checks the server makes, in the same order.
 *
 * Size is read from the `File` handle, never from anything the page could have
 * been told — the browser is the only source of truth available here.
 */
export const validateAttachment = (file: File): AttachmentRejection => {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { ok: false, reason: "too_large", limitMb: MAX_ATTACHMENT_BYTES / 1024 / 1024 };
  }

  const contentType = (file.type || "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
    return { ok: false, reason: "wrong_type", type: contentType || "unknown" };
  }

  return { ok: true };
};
