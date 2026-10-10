import { readinessHints } from "@resume-forge/shared-types";
import { JdMatchPanel, type JdServices } from "./JdMatchPanel";
import {
  ServerRewriteDialog,
  rewriteTarget,
  type RewriteServices,
} from "./ServerRewriteDialog";
import {
  computeReadiness,
  readinessProjection,
  type ReadinessCheck,
} from "@resume-forge/resume-core";
import type { ReadinessPanelProps } from "./ReadinessPanel";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ArrowLeft,
  Moon,
  Sun,
  ArrowDown,
  ArrowUp,
  Check,
  Download,
  Eye,
  EyeOff,
  Pencil,
  Redo2,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  Button,
  NodeGraphBackdrop,
  DocumentStatus,
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
import { EditResumeDialog } from "./EditResumeDialog";
import { ResumeDocument } from "./ResumeDocument";
import { ResumePage } from "./ResumePage";
import { SectionActions } from "./SectionActions";
import {
  EditorRail,
  EDITOR_PANELS,
  ContentPanel,
  DesignPanel,
  AtsPanel,
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
  guidance?: ReadinessCheck;
}
export function ManualResumeEditor({
  context,
  initialDraft,
  onSave,
  onDownload,
  readiness,
  jdMatch,
  rewrite,
  savedVersion = 0,
  saveLabel = "Save changes",
}: {
  context?: ShellFederationContext;
  initialDraft: ResumeDraft;
  onSave: (draft: ResumeDraft) => Promise<number>;
  onDownload?: () => Promise<void>;
  readiness?: Pick<ReadinessPanelProps, "load" | "run" | "dismiss">;
  jdMatch?: JdServices;
  rewrite?: RewriteServices;
  savedVersion?: number;
  saveLabel?: string;
}) {
  const [sampleDraft] = useState(() => structuredClone(initialDraft));
  const [history, dispatch] = useReducer(
    editorHistory<ResumeDraft>,
    sampleDraft,
    createHistory,
  );
  const [downloading, setDownloading] = useState(false);
  const downloadingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [saveFailure, setSaveFailure] = useState("");
  const [conflict, setConflict] = useState(false);
  const savingRef = useRef(false);
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
  const [aiSession, setAiSession] = useState<{
    base: ResumeDraft;
    target: DraftTarget;
  } | null>(null);
  const [deleting, setDeleting] = useState<DraftTarget | null>(null);
  const [notice, setNotice] = useState<{
    message: string;
    error: boolean;
  } | null>(null);
  const [noticeKey, setNoticeKey] = useState(0);
  const [panel, setPanel] = useState<EditorPanel>(
    readiness ? "ats" : "content",
  );
  const [panelOpen, setPanelOpen] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const barRef = useRef<HTMLElement>(null);
  const [barHeight, setBarHeight] = useState(72);
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const measure = () => {
      setBarHeight(bar.offsetHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => {
      observer.disconnect();
    };
  }, []);
  const canvasRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const draft = session?.candidate ?? history.current;
  const readinessPreview = useMemo(
    () => computeReadiness(readinessProjection(draft), readinessHints(draft)),
    [draft],
  );
  const previewChanged =
    isDirty(history) ||
    !!(
      session &&
      JSON.stringify(session.candidate) !== JSON.stringify(history.current)
    );
  const appearance = draft.appearance ?? DEFAULT_APPEARANCE;
  const selection =
    selected.type === "header" || targetValue(history.current, selected)
      ? selected
      : ({ type: "header" } as const);
  const section = sectionFor(history.current, selection);
  const selectedValue = targetValue(history.current, selection);
  const hidden = selectedValue?.hidden ?? false;
  const dirty = isDirty(history);
  useEffect(() => {
    if (!dirty && !inlinePending && savedVersion > 0) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [dirty, inlinePending, savedVersion]);

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
  const saveCurrent = useCallback(async () => {
    if (savingRef.current || conflict) return;
    savingRef.current = true;
    setSaving(true);
    setSaveFailure("");
    if (
      document.activeElement instanceof HTMLElement &&
      document.activeElement.dataset.inlineEditor === "true"
    )
      document.activeElement.blur();
    // Wait for the inline blur transaction before taking the save snapshot.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => {
        resolve();
      }),
    );
    const snapshot = structuredClone(historyRef.current.current);
    try {
      const version = await onSave(snapshot);
      dispatch({ type: "checkpoint", value: snapshot });
      announce(`Saved version ${String(version)} to your account.`);
    } catch (e) {
      setSaveFailure(
        e instanceof Error ? e.message : "Save failed. Your edits are kept.",
      );
      if (e instanceof Error && "code" in e && e.code === "revision_conflict")
        setConflict(true);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [onSave, conflict, announce]);
  const download = async () => {
    if (
      !onDownload ||
      downloadingRef.current ||
      savingRef.current ||
      dirty ||
      inlinePending ||
      !savedVersion
    )
      return;
    downloadingRef.current = true;
    setDownloading(true);
    try {
      await onDownload();
      announce(
        `PDF download started for saved version ${String(savedVersion)}.`,
      );
    } catch (e) {
      error(e instanceof Error ? e.message : "Could not download PDF. Retry.");
    } finally {
      downloadingRef.current = false;
      setDownloading(false);
    }
  };
  const closeAiPreview = () => {
    if (!aiSession) return;
    const target = aiSession.target;
    setAiSession(null);
    // Closing can expose another region beneath the pointer. Restore the reviewed target first.
    requestAnimationFrame(() => {
      setSelected(target);
      requestAnimationFrame(() => {
        toolbarRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
      });
    });
  };
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelHover = useCallback(() => {
    if (hoverTimer.current !== null) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
  }, []);
  useEffect(() => {
    cancelHover();
    return cancelHover;
  }, [cancelHover, mode, session, aiSession]);
  const select = (target: DraftTarget) => {
    cancelHover();
    setSelected((current) =>
      JSON.stringify(current) === JSON.stringify(target) ? current : target,
    );
  };
  const hover = (target: DraftTarget) => {
    cancelHover();
    // Crossing another section on the way to its predecessor's actions must
    // not relocate the toolbar before the pointer can reach it.
    hoverTimer.current = setTimeout(() => {
      select(target);
    }, 150);
  };
  const addEntry = (
    targetSection = section,
    base = history.current,
    guidance?: ReadinessCheck,
  ) => {
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
    setSession({ base: next, target, candidate: next, guidance });
  };
  const startEdit = (
    target: DraftTarget = selection,
    base = history.current,
    guidance?: ReadinessCheck,
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
      addEntry(targetSection, base, guidance);
      return;
    }
    setSelected(target);
    setSession({ base, target, candidate: base, guidance });
  };
  const updatePreview = useCallback((candidate: ResumeDraft) => {
    setSession((current) =>
      current && JSON.stringify(current.candidate) !== JSON.stringify(candidate)
        ? { ...current, candidate }
        : current,
    );
  }, []);
  const editRich = (target: DraftTarget, value: SummaryDocument) => {
    if (session || aiSession) return;
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
    if (session || aiSession) return false;
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
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (
        session ||
        aiSession ||
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
        void saveCurrent();
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
  }, [session, aiSession, deleting, leaving, mode, announce, saveCurrent]);
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
    if (dirty || inlinePending || savedVersion === 0) setLeaving(true);
    else context.onNavigate(`/w/${context.activeWorkspace.id}/resumes`);
  };
  const aiTarget = aiSession
    ? rewriteTarget(aiSession.base, aiSession.target)
    : undefined;
  const actionDisabled = !savedVersion
    ? "Save this resume first."
    : conflict
      ? "Reopen the latest saved resume to resolve the conflict."
      : dirty || inlinePending || saving
        ? "Save changes before requesting ATS or AI actions."
        : undefined;
  const onAtsTarget = (check: ReadinessCheck, edit: boolean) => {
    const target = check.target;
    if (!target) {
      setPanel("content");
      setPanelOpen(true);
      announce(
        `${check.title}: ${check.reason} Use Edit Content to add the missing section or entry.`,
      );
      return;
    }
    if (target.type !== "header" && !targetValue(history.current, target)) {
      error("This assessment target is no longer present. Save and recheck.");
      return;
    }
    select(target);
    if (edit) startEdit(target, history.current, check);
    else focusActions();
  };
  return (
    <div
      className={`rf-manual-workspace rf-tools-workspace${panelOpen ? " has-tool-panel" : ""}`}
      style={
        { "--editor-header-height": `${String(barHeight)}px` } as CSSProperties
      }
    >
      <div className="rf-editor-main">
        <header ref={barRef} className="rf-editor-bar">
          <button type="button" className="rf-studio-back" onClick={goBack}>
            <ArrowLeft size={18} aria-hidden="true" /> All resumes
          </button>
          <span className="rf-studio-wordmark">
            Forge <span>Studio</span>
          </span>
          <div className="rf-editor-title">
            <div>
              <h1>{history.current.title}</h1>
              <p>
                {savedVersion
                  ? `Saved version ${String(savedVersion)}`
                  : "Imported draft awaiting confirmation"}
              </p>
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
          <div className="rf-editor-actions">
            {context?.onToggleTheme ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={context.onToggleTheme}
                aria-label={
                  context.theme === "dark"
                    ? "Switch to light theme"
                    : "Switch to dark theme"
                }
              >
                {context.theme === "dark" ? (
                  <Sun size={18} />
                ) : (
                  <Moon size={18} />
                )}
              </Button>
            ) : null}
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
              disabled={saving || (!dirty && !inlinePending)}
              onClick={() => {
                change(
                  { type: "cancel" },
                  "Restored your last saved draft. Undo is available.",
                );
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={
                saving ||
                conflict ||
                (savedVersion > 0 && !dirty && !inlinePending)
              }
              onClick={() => {
                void saveCurrent();
              }}
            >
              <Check size={14} /> {saving ? "Saving…" : saveLabel}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={
                !onDownload ||
                !savedVersion ||
                saving ||
                downloading ||
                dirty ||
                inlinePending ||
                !!session ||
                !!aiSession
              }
              title={
                dirty || inlinePending
                  ? "Save changes before downloading PDF"
                  : `Download saved version ${String(savedVersion)}`
              }
              aria-describedby="rf-pdf-limit"
              onClick={() => {
                void download();
              }}
            >
              <Download size={14} />{" "}
              {downloading ? "Preparing PDF…" : "Download PDF"}
            </Button>
          </div>
        </header>
        <div className="rf-local-draft-note">
          <span>
            <DocumentStatus
              tone={saving || dirty || !savedVersion ? "pending" : "saved"}
            >
              {saving
                ? "Saving…"
                : dirty || !savedVersion
                  ? "Unsaved changes"
                  : "Saved to your account"}
            </DocumentStatus>
          </span>
          <span id="rf-pdf-limit">
            {onDownload
              ? dirty || inlinePending
                ? "Save changes before downloading PDF."
                : `PDF uses saved version ${String(savedVersion)}. ATS actions use this saved version.`
              : "Save this resume to enable PDF download, JD matching and AI requests."}
          </span>
        </div>
        {saveFailure ? (
          <div className="rf-save-error" role="alert">
            <p>{saveFailure}</p>
            {conflict ? (
              <p>
                Copy any edits you need, then reload to open the newer saved
                version.
              </p>
            ) : (
              <p>
                Your draft is kept here. If the request timed out, a save may
                have reached the server.
              </p>
            )}
          </div>
        ) : null}
        <EditorRail
          active={panel}
          open={panelOpen}
          onSelect={(key) => {
            setPanel(key);
            setPanelOpen(true);
          }}
          onToggle={() => {
            setPanelOpen((open) => !open);
          }}
        >
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
        </EditorRail>
        <div className={`rf-tools-layout${panelOpen ? " has-panel" : ""}`}>
          {panelOpen ? (
            <aside
              key={panel}
              id="rf-editor-tool-panel"
              className="rf-editor-tool-panel"
              aria-labelledby="rf-tool-panel-heading"
            >
              <div className="rf-inspector-heading">
                <NodeGraphBackdrop
                  density={18}
                  reducedMotion={context?.reducedMotion}
                />
                <h2 id="rf-tool-panel-heading">
                  {panel === "ats" || panel === "jd"
                    ? "Resume review"
                    : EDITOR_PANELS[panel].label}
                </h2>
              </div>
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
              {panel === "ats" || panel === "jd" ? (
                <div
                  className="rf-issue-filters rf-ats-modes"
                  aria-label="ATS assessment type"
                >
                  <button
                    type="button"
                    aria-pressed={panel === "ats"}
                    onClick={() => {
                      setPanel("ats");
                    }}
                  >
                    ATS readiness
                  </button>
                  <button
                    type="button"
                    aria-pressed={panel === "jd"}
                    onClick={() => {
                      setPanel("jd");
                    }}
                  >
                    Tailor to job
                  </button>
                </div>
              ) : null}
              {panel === "ats" ? (
                <AtsPanel
                  reducedMotion={context?.reducedMotion}
                  {...readiness}
                  label={(check) => {
                    if (!check.target) return "Resume";
                    if (check.target.type === "header")
                      return "Contact details";
                    const value = targetValue(history.current, check.target);
                    const section = sectionFor(history.current, check.target);
                    return value && "title" in value
                      ? `${value.title || "Untitled entry"} · ${section?.label ?? ""}`
                      : (section?.label ?? "Section");
                  }}
                  savedVersion={savedVersion}
                  preview={
                    previewChanged || !savedVersion
                      ? readinessPreview
                      : undefined
                  }
                  navigationDisabled={
                    !!(
                      conflict ||
                      inlinePending ||
                      saving ||
                      session ||
                      aiSession ||
                      deleting ||
                      leaving
                    )
                  }
                  disabledReason={
                    !savedVersion
                      ? "Save this resume before checking readiness."
                      : conflict
                        ? "Reopen the latest resume to resolve the save conflict."
                        : dirty ||
                            inlinePending ||
                            saving ||
                            session ||
                            aiSession ||
                            deleting ||
                            leaving
                          ? "Save changes and close edit dialogs before checking readiness."
                          : undefined
                  }
                  onTarget={onAtsTarget}
                />
              ) : null}
              {panel === "jd" ? (
                <JdMatchPanel
                  reducedMotion={context?.reducedMotion}
                  draft={draft}
                  services={jdMatch}
                  savedVersion={savedVersion}
                  disabledReason={
                    actionDisabled ||
                    (session || aiSession || deleting || leaving
                      ? "Close edit dialogs before running JD analysis."
                      : undefined)
                  }
                  onTarget={onAtsTarget}
                />
              ) : null}
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
              <span>Document layout</span>
            </div>
            <div className="rf-document-container" ref={canvasRef}>
              <ResumePage>
                <ResumeDocument
                  draft={draft}
                  selected={selection}
                  editable={mode === "editor" && !session && !aiSession}
                  onPending={setInlinePending}
                  onSelect={select}
                  onHover={hover}
                  onHoverExit={cancelHover}
                  onEdit={(target) => {
                    requestAnimationFrame(() => {
                      startEdit(target, historyRef.current.current);
                    });
                  }}
                  onActions={focusActions}
                  onInlineCommit={editInline}
                  onRichChange={editRich}
                />
              </ResumePage>
              {mode === "editor" && section?.kind !== "skills" ? (
                <SectionActions
                  containerRef={canvasRef}
                  toolbarRef={toolbarRef}
                  target={selection}
                  layoutKey={`${String(panelOpen)}:${panel}`}
                  draft={draft}
                  hidden={!!session || !!aiSession}
                  onPointerEnter={cancelHover}
                >
                  <span
                    className="rf-floating-target"
                    title={targetLabel(history.current, selection)}
                  >
                    {targetLabel(history.current, selection)}
                  </span>
                  {selection.type !== "header" &&
                  rewriteTarget(history.current, selection) ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      glow
                      className="rf-ai-entry-action"
                      onClick={() => {
                        setAiSession({
                          base: structuredClone(historyRef.current.current),
                          target: structuredClone(selection),
                        });
                      }}
                    >
                      Improve with AI
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
                </SectionActions>
              ) : null}
            </div>
            <p className="rf-paper-caption">
              Save changes stores a new version in your account. Text edits
              apply on blur or Enter; Escape cancels the active text edit. Alt
              Enter opens details. AI suggestions require review before saving.
              General readiness checks show draft previews and automatically
              check saved versions. JD matching and PDF downloads use your saved
              version and exclude unsaved edits.
            </p>
          </div>
        </div>
      </div>
      {notice && !session && !aiSession && !deleting && !leaving ? (
        <div className="rf-editor-toast" key={noticeKey}>
          <StatusBanner
            tone={notice.error ? "error" : "info"}
            showToneLabel={notice.error}
            title={notice.message}
            onDismiss={() => {
              setNotice(null);
            }}
          />
        </div>
      ) : null}
      {aiSession && aiTarget ? (
        <ServerRewriteDialog
          reducedMotion={context?.reducedMotion}
          base={aiSession.base}
          target={aiTarget}
          services={rewrite}
          disabledReason={
            actionDisabled ||
            (!rewrite
              ? "Save this resume before requesting AI suggestions."
              : undefined)
          }
          onClose={closeAiPreview}
          onApplied={(next) => {
            dispatch({ type: "edit", value: next });
            dispatch({ type: "checkpoint", value: next });
            closeAiPreview();
            announce(
              "AI changes saved as a new version. ATS results need a recheck.",
            );
          }}
        />
      ) : null}
      {session ? (
        <EditResumeDialog
          sample={sampleDraft}
          base={session.base}
          target={session.target}
          guidance={session.guidance}
          onImprove={
            rewrite && rewriteTarget(session.base, session.target)
              ? () => {
                  const target = structuredClone(session.target);
                  const base = structuredClone(history.current);
                  setSession(null);
                  setAiSession({ base, target });
                }
              : undefined
          }
          improveDisabledReason={actionDisabled}
          guidanceResult={
            session.guidance
              ? readinessPreview.checks.find(
                  (check) => check.id === session.guidance?.id,
                )
              : undefined
          }
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
        title="Leave unsaved changes?"
        description="Unsaved edits will be discarded. Saved resume versions stay in your account."
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
        <p>
          {savedVersion
            ? "Your last saved version will be available in My resumes."
            : "This import has not been saved yet."}
        </p>
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
