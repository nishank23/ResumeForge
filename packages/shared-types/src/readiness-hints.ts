import type { EditorDocument } from "./editor-document.js";

/** Derive only presence; the core scorer and AI projection never receive contacts. */
export function readinessHints(doc: Pick<EditorDocument, "header" | "sampleContact">) {
  return {
    contactComplete:
      !!(doc.header.firstName.trim() || doc.header.lastName.trim()) &&
      !!doc.sampleContact.email.trim() &&
      !!doc.sampleContact.phone.trim() &&
      !!(doc.header.city.trim() || doc.header.state.trim() || doc.header.country.trim()),
  };
}
