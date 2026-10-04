import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Download,
  Eye,
  EyeOff,
  Pencil,
  Redo2,
  Sparkles,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  Button,
  ConfirmDeleteDialog,
  Dialog,
  StatusBanner,
  type SummaryDocument,
  type ShellFederationContext,
} from "@resume-forge/shared";
import {
  createHistory,
  editorHistory,
  isDirty,
  type HistoryAction,
} from "./editor-history";
import {
  emptyEntry,
  emptySection,
  mutateTarget,
  SECTION_LABELS,
  sectionFor,
  targetLabel,
  targetValue,
  updateInlineDraft,
  type DraftTarget,
  type InlineField,
  type ResumeDraft,
  type SectionKind,
} from "./editor-draft";
import { createSampleDraft } from "./sample-draft";
import type { SampleResumeDocument } from "./sample-resume";
import { EditResumeDialog } from "./EditResumeDialog";
import { ResumeDocument } from "./ResumeDocument";
import {
  EditorRail,
  EDITOR_PANELS,
  ContentPanel,
  DesignPanel,
  AtsPanel,
  JdPanel,
  type EditorPanel,
} from "./EditorToolPanels";
import {
  DEFAULT_APPEARANCE,
  appearanceVariables,
  updateAppearance,
  type EditorAppearance,
} from "./editor-appearance";
import "./manual-editor.css";
import "./editor-tool-panels.css";

interface EditSession {
  base: ResumeDraft;
  target: DraftTarget;
  candidate: ResumeDraft;
}
export function ManualResumeEditor({
  context,
  sample,
}: {
  context?: ShellFederationContext;
  sample: SampleResumeDocument;
}) {
  const [sampleDraft] = useState(() => createSampleDraft(sample));
  const [history, dispatch] = useReducer(
    editorHistory<ResumeDraft>,
    sampleDraft,
    createHistory,
  );
  const [inlinePending, setInlinePending] = useState(false);
  const historyRef = useRef(history);
  useLayoutEffect(() => {
    historyRef.current = history;
  }, [history]);
  const [mode, setMode] = useState<"editor" | "preview">("editor");
  const [selected, setSelected] = useState<DraftTarget>({
    type: "section",
    sectionId: "sec-summary",
  });
  const [session, setSession] = useState<EditSession | null>(null);
  const [deleting, setDeleting] = useState<DraftTarget | null>(null);
  const [notice, setNotice] = useState<{
    message: string;
    error: boolean;
  } | null>(null);
  const [noticeKey, setNoticeKey] = useState(0);
  const [panel, setPanel] = useState<EditorPanel>("content");
  const [panelOpen, setPanelOpen] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState({ top: 0, left: 0 });
  const draft = session?.candidate ?? history.current;
  const appearance = draft.appearance ?? DEFAULT_APPEARANCE;
  const selection =
    selected.type === "header" || targetValue(history.current, selected)
      ? selected
      : ({ type: "header" } as const);
  const section = sectionFor(history.current, selection);
  const selectedValue = targetValue(history.current, selection);
  const hidden = selectedValue?.hidden ?? false;
  const dirty = isDirty(history);
  const selectionKey = JSON.stringify(selection);
  const announce = useCallback((message: string, error = false) => {
    setNotice({ message, error });
    setNoticeKey((key) => key + 1);
  }, []);
  const error = useCallback(
    (message: string) => {
      announce(message, true);
    },
    [announce],
  );
  const change = (action: HistoryAction<ResumeDraft>, message: string) => {
    dispatch(action);
    announce(message);
  };
  const select = (target: DraftTarget) => {
    setSelected((current) =>
      JSON.stringify(current) === JSON.stringify(target) ? current : target,
    );
  };
  const addEntry = (targetSection = section, base = history.current) => {
    if (!targetSection) return;
    const next = structuredClone(base);
    const match = next.sections.find((s) => s.id === targetSection.id);
    if (!match) return;
    const id = crypto.randomUUID();
    match.entries.push(emptyEntry(id));
    const target: DraftTarget = {
      type: "entry",
      sectionId: match.id,
      itemId: id,
    };
    setSelected(target);
    setSession({ base: next, target, candidate: next });
  };
  const startEdit = (
    target: DraftTarget = selection,
    base = history.current,
  ) => {
    const targetSection = sectionFor(base, target);
    if (targetSection?.kind === "skills")
      target = { type: "section", sectionId: targetSection.id };
    if (
      target.type === "section" &&
      targetSection &&
      ["experience", "education", "projects"].includes(targetSection.kind) &&
      !targetSection.entries.length
    ) {
      addEntry(targetSection, base);
      return;
    }
    setSelected(target);
    setSession({ base, target, candidate: base });
  };
  const updatePreview = useCallback((candidate: ResumeDraft) => {
    setSession((current) =>
      current && JSON.stringify(current.candidate) !== JSON.stringify(candidate)
        ? { ...current, candidate }
        : current,
    );
  }, []);
  const editRich = (target: DraftTarget, value: SummaryDocument) => {
    if (session) return;
    const next = structuredClone(history.current);
    const match = targetValue(next, target);
    if (!match || match.hidden) return;
    if (
      target.type === "section" &&
      "summary" in match &&
      match.kind === "summary"
    )
      match.summary = value;
    else if (target.type === "entry" && "description" in match)
      match.description = value;
    else return;
    dispatch({ type: "edit", value: next });
  };
  const editInline = (
    target: DraftTarget,
    field: InlineField,
    value: string,
  ) => {
    if (session) return false;
    const result = updateInlineDraft(history.current, target, field, value);
    if (!result.ok) {
      error(result.error);
      return false;
    }
    dispatch({ type: "edit", value: result.draft });
    return true;
  };
  const focusActions = () => {
    requestAnimationFrame(() =>
      (
        canvasRef.current?.querySelector<HTMLElement>(
          "[data-skills-dialog].is-selected",
        ) ??
        toolbarRef.current?.querySelector<HTMLButtonElement>(
          "[data-selection-edit]",
        ) ??
        canvasRef.current?.querySelector<HTMLElement>("[data-skills-dialog]")
      )?.focus(),
    );
  };
  const act = (
    action: "up" | "down" | "hide" | "delete",
    target = selection,
  ) => {
    const result = mutateTarget(history.current, target, action);
    if (!result.ok) {
      error(result.error);
      return;
    }
    change(
      { type: "edit", value: result.draft },
      action === "hide"
        ? "Preview visibility updated. Undo is available."
        : action === "delete"
          ? "Deleted from this draft. Undo is available."
          : "Position updated.",
    );
    if (action === "delete") {
      setSelected(
        target.type !== "header" && target.type !== "section"
          ? { type: "section", sectionId: target.sectionId }
          : { type: "header" },
      );
      focusActions();
    }
  };
  const addSection = (addKind: SectionKind) => {
    if (history.current.sections.some((s) => s.kind === addKind)) {
      error("This section already exists. Select it to edit or add entries.");
      return;
    }
    const next = structuredClone(history.current);
    const id = crypto.randomUUID();
    next.sections.push(emptySection(addKind, id));
    change(
      { type: "edit", value: next },
      `${SECTION_LABELS[addKind]} added. Use Undo to remove it.`,
    );
    select({ type: "section", sectionId: id });
    requestAnimationFrame(() => {
      [
        ...(canvasRef.current?.querySelectorAll<HTMLElement>(
          "[data-editor-target]",
        ) ?? []),
      ]
        .find(
          (element) =>
            element.dataset.editorTarget ===
            JSON.stringify({ type: "section", sectionId: id }),
        )
        ?.scrollIntoView({ block: "center" });
    });
  };
  useLayoutEffect(() => {
    const position = () => {
      const canvas = canvasRef.current;
      const toolbar = toolbarRef.current;
      if (!canvas || !toolbar || mode !== "editor" || session) return;
      const element = [
        ...canvas.querySelectorAll<HTMLElement>("[data-editor-target]"),
      ].find((node) => node.dataset.editorTarget === selectionKey);
      if (!element) return;
      // Item actions retain their target, but share the parent section's footer.
      const region =
        element.closest<HTMLElement>(".rf-resume-section") ?? element;
      const box = region.getBoundingClientRect(),
        outer = canvas.getBoundingClientRect();
      const width = toolbar.getBoundingClientRect().width;
      const next = {
        top: Math.max(0, box.bottom - outer.top + 4),
        left: Math.max(
          12,
          Math.min(
            box.left - outer.left + (box.width - width) / 2,
            outer.width - width - 12,
          ),
        ),
      };
      setAnchor((current) =>
        current.top === next.top && current.left === next.left ? current : next,
      );
    };
    position();
    const observer = new ResizeObserver(position);
    if (canvasRef.current) observer.observe(canvasRef.current);
    if (toolbarRef.current) observer.observe(toolbarRef.current);
    window.addEventListener("resize", position);
    return () => {
      window.removeEventListener("resize", position);
      observer.disconnect();
    };
  }, [selectionKey, draft, mode, panelOpen, panel, session]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (
        session ||
        deleting ||
        leaving ||
        !(event.ctrlKey || event.metaKey) ||
        event.altKey
      )
        return;
      const key = event.key.toLowerCase();
      const inline =
        document.activeElement instanceof HTMLElement &&
        document.activeElement.dataset.inlineEditor === "true";
      if (key === "s") {
        event.preventDefault();
        if (inline) (document.activeElement as HTMLElement).blur();
        dispatch({ type: "save" });
        announce("Saved a local checkpoint. Reloading clears this draft.");
      }
      if (mode === "editor" && !inline && (key === "z" || key === "y")) {
        if (
          document.activeElement instanceof HTMLElement &&
          document.activeElement.matches(
            'input, textarea, select, [contenteditable="true"]',
          )
        )
          return;
        event.preventDefault();
        dispatch({ type: key === "y" || event.shiftKey ? "redo" : "undo" });
        announce("Draft history updated.");
      }
    };
    document.addEventListener("keydown", shortcut);
    return () => {
      document.removeEventListener("keydown", shortcut);
    };
  }, [session, deleting, leaving, mode, announce]);
  const itemArrows =
    selection.type !== "header" && selection.type !== "section";
  const changeAppearance = (value: EditorAppearance) => {
    const result = updateAppearance(history.current, value);
    if (!result.ok) {
      error(result.error);
      return;
    }
    if (
      JSON.stringify(result.draft.appearance) ===
      JSON.stringify(history.current.appearance ?? DEFAULT_APPEARANCE)
    )
      return;
    dispatch({ type: "edit", value: result.draft });
  };
  const goBack = () => {
    if (!context?.onNavigate) {
      announce(
        "All resumes is available in the signed-in workspace at localhost:3000.",
      );
      return;
    }
    // Every local checkpoint is lost on navigation, even after Save locally.
    setLeaving(true);
  };
  return (
    <div
      className={`rf-manual-workspace rf-tools-workspace${panelOpen ? " has-tool-panel" : ""}`}
    >
      <EditorRail
        active={panel}
        open={panelOpen}
        onSelect={(key) => {
          setPanel(key);
          setPanelOpen(true);
        }}
        onBack={goBack}
        onToggle={() => {
          setPanelOpen((open) => !open);
        }}
      />
      <div className="rf-editor-main">
        <header className="rf-editor-bar">
          <div className="rf-editor-title">
            <div>
              <h1>{history.current.title}</h1>
              <p>Synthetic sample resume</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Edit resume title and contact details"
              onClick={() => {
                startEdit({ type: "header" });
              }}
            >
              <Pencil size={14} />
            </Button>
          </div>
          <div className="rf-mode-switch" aria-label="Resume view">
            <button
              type="button"
              aria-pressed={mode === "editor"}
              onClick={() => {
                setMode("editor");
              }}
            >
              Editor
            </button>
            <button
              type="button"
              aria-pressed={mode === "preview"}
              onClick={() => {
                setMode("preview");
              }}
            >
              Preview
            </button>
          </div>
          <div className="rf-editor-actions">
            <div className="rf-history-actions">
              <button
                type="button"
                disabled={!history.past.length && !inlinePending}
                aria-label="Undo"
                title="Undo (⌘/Ctrl Z outside a text field)"
                onClick={() => {
                  change({ type: "undo" }, "Undid the last draft change.");
                }}
              >
                <Undo2 size={17} />
              </button>
              <button
                type="button"
                disabled={!history.future.length}
                aria-label="Redo"
                onClick={() => {
                  change({ type: "redo" }, "Redid the draft change.");
                }}
              >
                <Redo2 size={17} />
              </button>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={!dirty && !inlinePending}
              onClick={() => {
                change(
                  { type: "cancel" },
                  "Restored the local checkpoint. Undo is available.",
                );
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!dirty && !inlinePending}
              onClick={() => {
                change(
                  { type: "save" },
                  "Saved a local checkpoint. Reloading clears this draft.",
                );
              }}
            >
              <Check size={14} /> Save locally
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled
              aria-describedby="rf-pdf-limit"
            >
              <Download size={14} /> Export PDF
            </Button>
          </div>
        </header>
        <div className="rf-local-draft-note">
          <span>
            <span className={`rf-draft-dot${dirty ? " is-dirty" : ""}`} />
            {dirty ? "Unsaved local changes" : "Local checkpoint"} · Fictional
            demo data. Save resets on reload.
          </span>
          <span id="rf-pdf-limit">
            AI, ATS and PDF services are not connected.
          </span>
        </div>
        <div className={`rf-tools-layout${panelOpen ? " has-panel" : ""}`}>
          {panelOpen ? (
            <aside
              key={panel}
              id="rf-editor-tool-panel"
              className="rf-editor-tool-panel"
              aria-labelledby="rf-tool-panel-heading"
            >
              <h2 id="rf-tool-panel-heading">{EDITOR_PANELS[panel].label}</h2>
              {panel === "content" ? (
                <ContentPanel
                  draft={history.current}
                  editable={mode === "editor"}
                  onEdit={(target) => {
                    startEdit(target);
                  }}
                  onAddEntry={(id) => {
                    addEntry(history.current.sections.find((s) => s.id === id));
                  }}
                  onAction={act}
                  onDelete={setDeleting}
                  onAddSection={addSection}
                  onEditor={() => {
                    setMode("editor");
                  }}
                />
              ) : null}
              {panel === "design" ? (
                <DesignPanel
                  appearance={appearance}
                  onChange={changeAppearance}
                />
              ) : null}
              {panel === "ats" ? <AtsPanel /> : null}
              {panel === "jd" ? <JdPanel /> : null}
            </aside>
          ) : null}
          <div
            className="rf-paper-stage"
            aria-label="Resume document workspace"
            data-editor-mode={mode}
            style={appearanceVariables(appearance)}
          >
            <div className="rf-paper-meta">
              <span>
                {mode === "editor"
                  ? "Click text to type · Preview shows document spacing"
                  : "Preview · hidden content excluded"}
              </span>
              <span>Continuous page · no PDF pagination</span>
            </div>
            <div className="rf-document-container" ref={canvasRef}>
              <ResumeDocument
                draft={draft}
                selected={selection}
                editable={mode === "editor" && !session}
                onPending={setInlinePending}
                onSelect={select}
                onEdit={(target) => {
                  requestAnimationFrame(() => {
                    startEdit(target, historyRef.current.current);
                  });
                }}
                onActions={focusActions}
                onInlineCommit={editInline}
                onRichChange={editRich}
              />
              {mode === "editor" && section?.kind !== "skills" ? (
                <div
                  ref={toolbarRef}
                  hidden={!!session}
                  className="rf-floating-actions"
                  aria-label="Selected content actions"
                  style={{ top: anchor.top, left: anchor.left }}
                >
                  <span
                    className="rf-floating-target"
                    title={targetLabel(history.current, selection)}
                  >
                    {targetLabel(history.current, selection)}
                  </span>
                  {selection.type !== "header" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        announce(
                          "AI improvement is not connected. It needs a configured provider, grounded facts and saved version review.",
                        );
                      }}
                    >
                      <Sparkles size={14} /> Improve with AI
                    </Button>
                  ) : null}
                  {itemArrows ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Move selected item up"
                        onClick={() => {
                          act("up");
                        }}
                      >
                        <ArrowUp size={15} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Move selected item down"
                        onClick={() => {
                          act("down");
                        }}
                      >
                        <ArrowDown size={15} />
                      </Button>
                    </>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon"
                    data-selection-edit
                    aria-label="Edit selected content"
                    onClick={() => {
                      startEdit();
                    }}
                  >
                    <Pencil size={15} />
                  </Button>
                  {selection.type !== "header" ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={
                          hidden
                            ? "Show selected content in preview"
                            : "Hide selected content from preview"
                        }
                        onClick={() => {
                          act("hide");
                        }}
                      >
                        {hidden ? <Eye size={15} /> : <EyeOff size={15} />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete selected content"
                        onClick={() => {
                          setDeleting(selection);
                        }}
                      >
                        <Trash2 size={15} />
                      </Button>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
            <p className="rf-paper-caption">
              All content is synthetic demonstration data. Drafts stay in memory
              and clear when you leave or reload. Text edits apply on blur or
              Enter; Escape cancels the active text edit and focuses its
              actions. Alt Enter opens details. Dates and links use the
              validated dialog. AI, ATS and PDF export are not connected.
            </p>
          </div>
        </div>
      </div>
      {notice && !session && !deleting && !leaving ? (
        <div className="rf-editor-toast" key={noticeKey}>
          <StatusBanner
            tone={notice.error ? "error" : "info"}
            title={notice.message}
            onDismiss={() => {
              setNotice(null);
            }}
          />
        </div>
      ) : null}
      {session ? (
        <EditResumeDialog
          sample={sampleDraft}
          base={session.base}
          target={session.target}
          onPreview={updatePreview}
          onCancel={() => {
            setSelected(
              session.target.type === "header" ||
                targetValue(history.current, session.target)
                ? session.target
                : {
                    type: "section",
                    sectionId: session.target.sectionId,
                  },
            );
            setSession(null);
            focusActions();
            announce("Dialog changes discarded.");
          }}
          onSave={(candidate) => {
            dispatch({ type: "edit", value: candidate });
            setSelected(session.target);
            setSession(null);
            focusActions();
            announce("Changes applied to the local draft.");
          }}
        />
      ) : null}
      <Dialog
        open={leaving}
        onOpenChange={setLeaving}
        title="Leave this local draft?"
        description="All draft text and formatting will clear when you return to the resume list, including local checkpoints."
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setLeaving(false);
              }}
            >
              Stay in editor
            </Button>
            <Button
              onClick={() => {
                context?.onNavigate?.(
                  `/w/${context.activeWorkspace.id}/resumes`,
                );
              }}
            >
              Leave and return to all resumes
            </Button>
          </>
        }
      >
        <p>Your draft is not saved to the database yet.</p>
      </Dialog>
      <ConfirmDeleteDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Delete from this draft?"
        description="Only the selected content will be removed. Undo restores it until you leave or reload."
        resourceName={
          deleting ? targetLabel(history.current, deleting).slice(0, 180) : ""
        }
        confirmLabel="Delete from draft"
        onConfirm={() => {
          if (deleting) act("delete", deleting);
          setDeleting(null);
        }}
      />
    </div>
  );
}
