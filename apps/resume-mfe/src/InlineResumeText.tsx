import { useLayoutEffect, useRef } from "react";

interface InlineResumeTextProps {
  value: string;
  label: string;
  placeholder: string;
  editable: boolean;
  onPending: (pending: boolean) => void;
  onSelect: () => void;
  onCommit: (text: string) => boolean;
  onEdit: () => void;
  onActions: () => void;
}
// Leave the active DOM text alone while typing; React must not reset the caret.
export function InlineResumeText({
  value,
  label,
  placeholder,
  editable,
  onPending,
  onSelect,
  onCommit,
  onEdit,
  onActions,
}: InlineResumeTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (element && element.textContent !== value) element.textContent = value;
  }, [value]);
  return (
    <span
      ref={ref}
      className="rf-inline-resume-text"
      contentEditable={editable}
      suppressContentEditableWarning
      role={editable ? "textbox" : undefined}
      aria-label={editable ? label : undefined}
      aria-multiline={false}
      data-inline-editor={editable || undefined}
      data-placeholder={editable ? placeholder : undefined}
      tabIndex={editable ? 0 : undefined}
      spellCheck={editable}
      onFocus={() => {
        if (editable) onSelect();
      }}
      onClick={(event) => {
        if (editable) {
          event.stopPropagation();
          onSelect();
        }
      }}
      onInput={() => {
        if (editable) onPending(true);
      }}
      onBlur={(event) => {
        if (editable) {
          // Read the typed text, not CSS-transformed headings such as uppercase.
          if (!onCommit(event.currentTarget.textContent))
            event.currentTarget.textContent = value;
          onPending(false);
        }
      }}
      onDoubleClick={(event) => {
        if (editable && event.altKey) {
          event.preventDefault();
          event.currentTarget.blur();
          onEdit();
        }
      }}
      onPaste={(event) => {
        if (!editable) return;
        event.preventDefault();
        const text = event.clipboardData
          .getData("text/plain")
          .replace(/\s*\n\s*/g, " ");
        const selection = window.getSelection();
        if (!selection?.rangeCount) return;
        const range = selection.getRangeAt(0);
        if (!event.currentTarget.contains(range.commonAncestorContainer))
          return;
        range.deleteContents();
        const node = document.createTextNode(text);
        range.insertNode(node);
        range.setStartAfter(node);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        onPending(true);
      }}
      onKeyDown={(event) => {
        if (!editable) return;
        if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.blur();
          if (event.altKey) onEdit();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.textContent = value;
          event.currentTarget.blur();
          onActions();
        }
      }}
    />
  );
}
