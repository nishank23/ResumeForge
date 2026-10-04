import { useEffect } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, List } from "lucide-react";
import { normalizeSummary, type SummaryDocument } from "./summary-document";

const extensions = [
  StarterKit.configure({
    blockquote: false,
    code: false,
    codeBlock: false,
    heading: false,
    horizontalRule: false,
    orderedList: false,
    strike: false,
    underline: false,
    link: false,
    undoRedo: false,
    trailingNode: false,
    dropcursor: false,
    gapcursor: false,
    listKeymap: false,
  }),
];

export interface SummaryEditorProps {
  readonly value: SummaryDocument;
  readonly onChange: (value: SummaryDocument) => void;
  readonly label: string;
  readonly editable?: boolean;
  readonly toolbar?: boolean;
  readonly onFocus?: () => void;
}

/** Two instances can share one normalized draft/history without independent undo stacks. */
export default function TiptapSummaryEditor({
  value,
  onChange,
  label,
  editable = true,
  toolbar = false,
  onFocus,
}: SummaryEditorProps) {
  const editor = useEditor({
    extensions,
    content: value,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": label,
        "aria-multiline": "true",
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(normalizeSummary(editor.getJSON()));
    },
    onFocus: () => onFocus?.(),
  });
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      bullets: editor.isActive("bulletList"),
    }),
  });
  useEffect(() => {
    if (
      JSON.stringify(normalizeSummary(editor.getJSON())) !==
      JSON.stringify(value)
    ) {
      const selection = editor.state.selection;
      editor.commands.setContent(value, { emitUpdate: false });
      if (editor.isFocused) {
        const end = editor.state.doc.content.size;
        editor.commands.setTextSelection({
          from: Math.min(selection.from, end),
          to: Math.min(selection.to, end),
        });
      }
    }
  }, [editor, value]);
  useEffect(() => {
    editor.setEditable(editable, false);
    editor.setOptions({
      editorProps: {
        attributes: {
          role: editable ? "textbox" : "region",
          "aria-label": label,
          "aria-multiline": editable ? "true" : "false",
          spellcheck: "true",
          tabindex: editable ? "0" : "-1",
        },
      },
    });
  }, [editor, editable, label]);
  return (
    <div className="rf-summary-editor">
      {toolbar && editable ? (
        <div
          className="rf-summary-toolbar"
          role="group"
          aria-label={`Formatting for ${label}`}
        >
          <button
            type="button"
            aria-label="Bold"
            aria-pressed={state.bold}

            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold size={16} />
          </button>
          <button
            type="button"
            aria-label="Italic"
            aria-pressed={state.italic}

            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic size={16} />
          </button>
          <button
            type="button"
            aria-label="Bullet list"
            aria-pressed={state.bullets}

            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List size={17} />
          </button>
        </div>
      ) : null}
      <EditorContent editor={editor} />
    </div>
  );
}
