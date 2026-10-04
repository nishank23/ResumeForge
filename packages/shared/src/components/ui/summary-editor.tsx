import { lazy, Suspense } from "react";
import type { SummaryEditorProps } from "./tiptap-summary-editor";
export type { SummaryEditorProps } from "./tiptap-summary-editor";
const TiptapSummaryEditor = lazy(() => import("./tiptap-summary-editor"));

/** Load the editor engine only when a resume editing surface is mounted. */
export function SummaryEditor(props: SummaryEditorProps) {
  return (
    <Suspense fallback={<p role="status">Loading summary editor…</p>}>
      <TiptapSummaryEditor {...props} />
    </Suspense>
  );
}
