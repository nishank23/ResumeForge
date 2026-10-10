import { TextComparison } from "@resume-forge/shared";
import { wordDiff } from "./word-diff";

export function RewriteTextChange({
  change,
}: {
  change: { label: string; original: string; proposed: string };
}) {
  return (
    <section className="rf-ai-change">
      <h3>{change.label}</h3>
      <p>
        {wordDiff(change.original, change.proposed).map((part, index) =>
          part.type === "removed" ? (
            <del key={index}>
              <span className="sr-only">Removed: </span>
              {part.text}
            </del>
          ) : part.type === "added" ? (
            <ins key={index}>
              <span className="sr-only">Added: </span>
              {part.text}
            </ins>
          ) : (
            <span key={index}>{part.text}</span>
          ),
        )}
      </p>
      <details>
        <summary>Read original and suggested text</summary>
        <TextComparison
          original={change.original}
          suggested={change.proposed}
        />
      </details>
    </section>
  );
}
