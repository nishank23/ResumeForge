import { AtsJobFitPanel, type AtsJobFitServices } from "./AtsJobFitPanel";
import type { TailoringServices } from "./TailoringDialog";
import { TailoringDialog } from "./TailoringDialog";
import {
  ServerRewriteDialog,
  rewriteTarget,
  type RewriteServices,
} from "./ServerRewriteDialog";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ArrowLeft,
  Check,
  Download,
  Eye,
  Pencil,
  BriefcaseBusiness,
  X,
} from "lucide-react";
import {
  Button,
  DocumentStatus,
  ConfirmDeleteDialog,
  Dialog,
  DropdownMenu,
  useMobileOrTouchViewport,
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
import "./workspace-ux.css";

interface EditSession {
  base: ResumeDraft;
  target: DraftTarget;
  candidate: ResumeDraft;
}
export function ManualResumeEditor({
  context,
  initialDraft,
  onSave,
  onDownload,
  atsAssessment,
  jdMatch,
  rewrite,
  savedVersion = 0,
  saveLabel = "Save changes",
  initialTailoringOpen = false,
}: {
  context?: ShellFederationContext;
  initialDraft: ResumeDraft;
  onSave: (draft: ResumeDraft) => Promise<number>;
  onDownload?: (version: number, title: string) => Promise<void>;
  initialTailoringOpen?: boolean;
  atsAssessment?: AtsJobFitServices;
  jdMatch?: { tailoring?: TailoringServices };
  rewrite?: RewriteServices;
  savedVersion?: number;
  saveLabel?: string;
}) {
  const { isCompact } = useMobileOrTouchViewport();
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
  const [actionsVisible, setActionsVisible] = useState(false);
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
  const [panel, setPanel] = useState<EditorPanel>("content");
  const [panelOpen, setPanelOpen] = useState(false);
  const [mobileView, setMobileView] = useState<"resume" | "tools">("resume");
  const [tailoringOpen, setTailoringOpen] = useState(initialTailoringOpen);
  const [tailoringJd, setTailoringJd] = useState("");
  const [tailoringVersion, setTailoringVersion] = useState<number | null>(null);
  const preparingTailoring = useRef(false);
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
  useEffect(() => {
    if (!notice || notice.error) return;
    const timer = setTimeout(() => {
      setNotice(null);
    }, 4500);
    return () => {
      clearTimeout(timer);
    };
  }, [notice, noticeKey]);
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
      return { version, draft: snapshot };
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
      conflict ||
      session ||
      aiSession
    )
      return;
    downloadingRef.current = true;
    setDownloading(true);
    try {
      const saved =
        isDirty(historyRef.current) || inlinePending || !savedVersion
          ? await saveCurrent()
          : { version: savedVersion, draft: historyRef.current.current };
      if (!saved) return;
      await onDownload(saved.version, saved.draft.title);
      announce(
        `PDF download started for saved version ${String(saved.version)}.`,
      );
    } catch (e) {
      error(
        e instanceof Error
          ? e.message
          : "Your resume is saved, but PDF download failed. Retry download.",
      );
    } finally {
      downloadingRef.current = false;
      setDownloading(false);
    }
  };
  const requestTailoring = async (jd = "") => {
    if (
      !jdMatch?.tailoring ||
      preparingTailoring.current ||
      savingRef.current ||
      downloadingRef.current ||
      conflict ||
      session ||
      aiSession
    )
      return;
    preparingTailoring.current = true;
    setTailoringJd(jd);
    const saved =
      isDirty(historyRef.current) || inlinePending || !savedVersion
        ? await saveCurrent()
        : { version: savedVersion, draft: historyRef.current.current };
    if (!saved) {
      preparingTailoring.current = false;
      return;
    }
    // Wait for the owner to bind its API callbacks to the newly returned revision.
    setTailoringVersion(saved.version);
  };
  useEffect(() => {
    if (tailoringVersion === null || savedVersion !== tailoringVersion) return;
    if (
      !dirty &&
      !inlinePending &&
      !session &&
      !aiSession &&
      !deleting &&
      !leaving &&
      !conflict &&
      jdMatch?.tailoring
    )
      setTailoringOpen(true);
    else
      announce(
        "Your draft changed while saving, or an edit dialog is open. Finish editing, then save and tailor again.",
      );
    preparingTailoring.current = false;
    setTailoringVersion(null);
  }, [
    tailoringVersion,
    savedVersion,
    dirty,
    inlinePending,
    jdMatch,
    session,
    aiSession,
    deleting,
    leaving,
    conflict,
    announce,
  ]);
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
    setActionsVisible(true);
    setSelected((current) =>
      JSON.stringify(current) === JSON.stringify(target) ? current : target,
    );
  };
  const hover = (target: DraftTarget) => {
    cancelHover();
    // Delay crossing another region so the current actions stay reachable.
    hoverTimer.current = setTimeout(() => {
      select(target);
    }, 150);
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
  const focusActions = (preferTools = true) => {
    requestAnimationFrame(() =>
      (
        (preferTools && panelOpen && mobileView === "tools"
          ? document.getElementById("rf-tool-panel-heading")
          : null) ??
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
      announce("Open All resumes from your signed-in workspace.");
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
  const documentBody = (
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
  );
  return (
    <div
      className={`rf-manual-workspace rf-tools-workspace rf-ux-workspace${panelOpen ? " has-tool-panel" : ""}`}
      data-mobile-view={mobileView}
      data-target-active={actionsVisible}
      style={
        { "--editor-header-height": `${String(barHeight)}px` } as CSSProperties
      }
    >
      <div className="rf-editor-main">
        <header ref={barRef} className="rf-editor-bar">
          <button type="button" className="rf-studio-back" onClick={goBack}>
            <ArrowLeft size={18} aria-hidden="true" /> All resumes
          </button>
          <div className="rf-editor-title">
            <div>
              <h1>{history.current.title}</h1>
              <DocumentStatus
                tone={
                  saving || dirty || inlinePending || !savedVersion
                    ? "pending"
                    : "saved"
                }
              >
                {saving
                  ? "Saving…"
                  : dirty || inlinePending || !savedVersion
                    ? "Unsaved changes"
                    : "Saved"}
              </DocumentStatus>
            </div>
          </div>
          <div className="rf-editor-actions">
            <DropdownMenu
              ariaLabel="Edit actions"
              triggerLabel="More"
              items={[
                {
                  id: "details",
                  label: "Edit resume title and contact details",
                  onSelect: () => {
                    startEdit({ type: "header" });
                  },
                },
                {
                  id: "sections",
                  label: "Manage sections",
                  onSelect: () => {
                    setPanel("content");
                    setPanelOpen(true);
                    setMobileView("tools");
                  },
                },
                {
                  id: "undo",
                  label: "Undo",
                  disabled: !history.past.length && !inlinePending,
                  onSelect: () => {
                    change({ type: "undo" }, "Undid the last draft change.");
                  },
                },
                {
                  id: "redo",
                  label: "Redo",
                  disabled: !history.future.length,
                  onSelect: () => {
                    change({ type: "redo" }, "Redid the draft change.");
                  },
                },
                {
                  id: "cancel",
                  label: "Discard unsaved edits",
                  disabled: saving || (!dirty && !inlinePending),
                  onSelect: () => {
                    change(
                      { type: "cancel" },
                      "Restored your saved draft. Undo is available.",
                    );
                  },
                },
                ...(context?.onToggleTheme
                  ? [
                      {
                        id: "theme",
                        label:
                          context.theme === "dark"
                            ? "Switch to light theme"
                            : "Switch to dark theme",
                        onSelect: context.onToggleTheme,
                      },
                    ]
                  : []),
              ]}
            />
            {jdMatch?.tailoring ? (
              <Button
                className="rf-direct-tailor"
                size="sm"
                disabled={
                  saving ||
                  downloading ||
                  conflict ||
                  !!session ||
                  !!aiSession ||
                  tailoringVersion !== null
                }
                onClick={() => void requestTailoring()}
              >
                <BriefcaseBusiness size={16} aria-hidden="true" />
                {saving || tailoringVersion !== null
                  ? "Preparing…"
                  : dirty || inlinePending
                    ? "Save & tailor"
                    : "Tailor for a job"}
              </Button>
            ) : null}
            {dirty || inlinePending || !onDownload ? (
              <Button
                className="rf-explicit-save"
                variant={onDownload ? "ghost" : "default"}
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
            ) : null}
            {onDownload ? (
              <Button
                className="rf-save-download"
                size="sm"
                variant="outline"
                disabled={
                  conflict || saving || downloading || !!session || !!aiSession
                }
                title={
                  dirty || inlinePending
                    ? "Save your changes, then download this version"
                    : `Download saved version ${String(savedVersion)}`
                }
                aria-describedby="rf-pdf-limit"
                onClick={() => {
                  void download();
                }}
              >
                <Download size={14} />{" "}
                {downloading
                  ? "Preparing PDF…"
                  : dirty || inlinePending
                    ? "Save & download"
                    : "Download PDF"}
              </Button>
            ) : null}
          </div>
        </header>
        <span id="rf-pdf-limit" className="rf-visually-hidden">
          {onDownload
            ? "Download saves pending edits and exports that saved version."
            : "Review the fields, then confirm this import."}
        </span>
        {notice &&
        !session &&
        !aiSession &&
        !deleting &&
        !leaving &&
        !tailoringOpen ? (
          <div className="rf-editor-inline-notice" key={noticeKey}>
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
          active={panelOpen ? panel : undefined}
          onSelect={(key) => {
            if (key === "write") {
              setPanelOpen(false);
              setMobileView("resume");
              setMode("editor");
            } else {
              setPanel(key);
              setPanelOpen(true);
              setMobileView("tools");
            }
          }}
        >
          <Button
            size="sm"
            variant="ghost"
            aria-pressed={mode === "preview"}
            onClick={() => {
              setMode(mode === "editor" ? "preview" : "editor");
              setPanelOpen(false);
              setMobileView("resume");
            }}
          >
            {mode === "editor" ? (
              <Eye size={16} aria-hidden="true" />
            ) : (
              <Pencil size={16} aria-hidden="true" />
            )}
            {mode === "editor" ? "Preview" : "Back to writing"}
          </Button>
        </EditorRail>
        <div className={`rf-tools-layout${panelOpen ? " has-panel" : ""}`}>
          <div
            className="rf-paper-stage"
            aria-label="Resume document workspace"
            data-editor-mode={mode}
            style={appearanceVariables(appearance)}
          >
            {mode === "editor" &&
            actionsVisible &&
            section?.kind !== "skills" ? (
              <SectionActions
                inline
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
                <Button
                  variant="ghost"
                  size="sm"
                  data-selection-edit
                  aria-label="Edit selected content"
                  onClick={() => {
                    startEdit();
                  }}
                >
                  <Pencil size={15} aria-hidden="true" /> Edit details
                </Button>
                {selection.type !== "header" ? (
                  <DropdownMenu
                    ariaLabel="More selected content actions"
                    triggerLabel="More"
                    items={[
                      ...(itemArrows
                        ? [
                            {
                              id: "up",
                              label: "Move up",
                              onSelect: () => {
                                act("up");
                              },
                            },
                            {
                              id: "down",
                              label: "Move down",
                              onSelect: () => {
                                act("down");
                              },
                            },
                          ]
                        : []),
                      {
                        id: "visibility",
                        label: hidden ? "Show in resume" : "Hide from resume",
                        onSelect: () => {
                          act("hide");
                        },
                      },
                      {
                        id: "delete",
                        label: "Delete selected content",
                        onSelect: () => {
                          setDeleting(selection);
                        },
                      },
                    ]}
                  />
                ) : null}
              </SectionActions>
            ) : null}
            <div className="rf-document-container" ref={canvasRef}>
              {isCompact && mode === "editor" ? (
                <div className="rf-mobile-document">{documentBody}</div>
              ) : (
                <ResumePage>{documentBody}</ResumePage>
              )}
            </div>
          </div>
          {panelOpen ? (
            <aside
              key={panel}
              id="rf-editor-tool-panel"
              className={`rf-editor-tool-panel${panel === "ats" || panel === "jd" ? " rf-review-panel" : ""}`}
              aria-labelledby="rf-tool-panel-heading"
            >
              <div className="rf-inspector-heading">
                <h2 id="rf-tool-panel-heading" tabIndex={-1}>
                  {panel === "ats" || panel === "jd"
                    ? "Improve your resume"
                    : EDITOR_PANELS[panel].label}
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Close tools and return to resume"
                  onClick={() => {
                    setPanelOpen(false);
                    setMobileView("resume");
                    requestAnimationFrame(() =>
                      document
                        .querySelector<HTMLButtonElement>("[data-editor-write]")
                        ?.focus(),
                    );
                  }}
                >
                  <X size={18} aria-hidden="true" />
                </Button>
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
                <AtsJobFitPanel
                  reducedMotion={context?.reducedMotion}
                  services={atsAssessment}
                  savedVersion={savedVersion}
                  disabledReason={
                    actionDisabled ||
                    (session || aiSession || deleting || leaving
                      ? "Close edit dialogs before checking job fit."
                      : undefined)
                  }
                  onTailor={
                    jdMatch?.tailoring
                      ? (jd) => void requestTailoring(jd)
                      : undefined
                  }
                />
              ) : null}
            </aside>
          ) : null}
        </div>
      </div>
      {tailoringOpen && jdMatch?.tailoring ? (
        <TailoringDialog
          base={history.current}
          savedVersion={savedVersion}
          initialJd={tailoringJd}
          services={jdMatch.tailoring}
          disabledReason={actionDisabled}
          reducedMotion={context?.reducedMotion}
          onClose={() => {
            setTailoringOpen(false);
          }}
        />
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
