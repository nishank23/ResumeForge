import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Trash2,
  FileText,
  Palette,
  Gauge,
  Briefcase,
  ArrowLeft,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Button, Dialog } from "@resume-forge/shared";
import {
  SECTION_LABELS,
  type DraftTarget,
  type ResumeDraft,
  type SectionKind,
} from "./editor-draft";
import {
  APPEARANCE_BOUNDS,
  DEFAULT_APPEARANCE,
  PAPER_COLORS,
  PAPER_FONTS,
  TYPE_ROLES,
  TYPE_SIZE_BOUNDS,
  appearancePreset,
  type EditorAppearance,
  type TypeRole,
} from "./editor-appearance";

export const EDITOR_PANELS = {
  content: { label: "Edit Content", icon: FileText },
  design: { label: "Customize Template", icon: Palette },
  ats: { label: "ATS Score", icon: Gauge },
  jd: { label: "Optimize for JD", icon: Briefcase },
} as const;
export type EditorPanel = keyof typeof EDITOR_PANELS;

export function EditorRail({
  active,
  open,
  onSelect,
  onBack,
  onToggle,
}: {
  active: EditorPanel;
  open: boolean;
  onSelect: (panel: EditorPanel) => void;
  onBack: () => void;
  onToggle: () => void;
}) {
  return (
    <nav className="rf-editor-rail" aria-label="Resume editor tools">
      <button className="rf-rail-back" type="button" onClick={onBack}>
        <ArrowLeft size={20} aria-hidden="true" />
        <span>Back to all resumes</span>
      </button>
      <div className="rf-rail-tabs">
        {(Object.keys(EDITOR_PANELS) as EditorPanel[]).map((key) => {
          const { label, icon: Icon } = EDITOR_PANELS[key];
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active === key && open}
              aria-controls="rf-editor-tool-panel"
              onClick={() => {
                onSelect(key);
              }}
            >
              <Icon size={21} aria-hidden="true" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
      <button
        className="rf-panel-toggle"
        type="button"
        aria-label={open ? "Collapse tool panel" : "Expand tool panel"}
        aria-expanded={open}
        aria-controls="rf-editor-tool-panel"
        onClick={onToggle}
      >
        {open ? (
          <PanelLeftClose size={19} aria-hidden="true" />
        ) : (
          <PanelLeftOpen size={19} aria-hidden="true" />
        )}
        <span>{open ? "Collapse" : "Expand"}</span>
      </button>
    </nav>
  );
}

export function ContentPanel({
  draft,
  editable,
  onEdit,
  onAddEntry,
  onAction,
  onDelete,
  onAddSection,
  onEditor,
}: {
  draft: ResumeDraft;
  editable: boolean;
  onEdit: (target: DraftTarget) => void;
  onAddEntry: (sectionId: string) => void;
  onAction: (action: "up" | "down" | "hide", target: DraftTarget) => void;
  onDelete: (target: DraftTarget) => void;
  onAddSection: (kind: SectionKind) => void;
  onEditor: () => void;
}) {
  const [kind, setKind] = useState<SectionKind>("summary");
  return (
    <div className="rf-content-tools">
      <p className="rf-tool-hint">
        Edit directly on the paper, or open a section's details here.
      </p>
      {!editable ? (
        <Button variant="outline" size="sm" onClick={onEditor}>
          Switch to Editor to edit
        </Button>
      ) : null}
      <Button
        variant="outline"
        className="rf-personal-details"
        disabled={!editable}
        onClick={() => {
          onEdit({ type: "header" });
        }}
      >
        <Pencil size={15} aria-hidden="true" /> Personal information
      </Button>
      {draft.sections.map((section) => {
        const target: DraftTarget = { type: "section", sectionId: section.id };
        const entries = ["experience", "education", "projects"].includes(
          section.kind,
        );
        return (
          <details className="rf-content-section" key={section.id}>
            <summary>
              <span>
                {section.label}
                {section.hidden ? " (hidden)" : ""}
              </span>
              {entries ? (
                <small>
                  {section.entries.length}{" "}
                  {section.entries.length === 1 ? "entry" : "entries"}
                </small>
              ) : null}
            </summary>
            <div className="rf-content-section-body">
              {entries ? (
                <>
                  {section.entries.map((entry) => (
                    <button
                      type="button"
                      className="rf-panel-entry"
                      disabled={!editable}
                      key={entry.id}
                      onClick={() => {
                        onEdit({
                          type: "entry",
                          sectionId: section.id,
                          itemId: entry.id,
                        });
                      }}
                    >
                      <span>
                        {entry.title || "Untitled entry"}
                        {entry.hidden ? " (hidden)" : ""}
                      </span>
                      <Pencil size={14} aria-hidden="true" />
                    </button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!editable}
                    onClick={() => {
                      onAddEntry(section.id);
                    }}
                  >
                    <Plus size={14} aria-hidden="true" /> Add entry
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!editable}
                  onClick={() => {
                    onEdit(target);
                  }}
                >
                  <Pencil size={14} aria-hidden="true" /> Edit details
                </Button>
              )}
              <div
                className="rf-panel-section-actions"
                aria-label={`${section.label} section actions`}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={!editable}
                  aria-label={`Move ${section.label} section up`}
                  onClick={() => {
                    onAction("up", target);
                  }}
                >
                  <ArrowUp size={15} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={!editable}
                  aria-label={`Move ${section.label} section down`}
                  onClick={() => {
                    onAction("down", target);
                  }}
                >
                  <ArrowDown size={15} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={!editable}
                  aria-label={`${section.hidden ? "Show" : "Hide"} ${section.label} section`}
                  onClick={() => {
                    onAction("hide", target);
                  }}
                >
                  {section.hidden ? <Eye size={15} /> : <EyeOff size={15} />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={!editable}
                  aria-label={`Delete ${section.label} section`}
                  onClick={() => {
                    onDelete(target);
                  }}
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            </div>
          </details>
        );
      })}
      <div className="rf-panel-add-section">
        <label htmlFor="rf-add-panel-section">Add a missing section</label>
        <select
          id="rf-add-panel-section"
          value={kind}
          disabled={!editable}
          onChange={(e) => {
            setKind(e.target.value as SectionKind);
          }}
        >
          {(Object.keys(SECTION_LABELS) as SectionKind[])
            .filter((key) => key !== "languages")
            .map((key) => (
              <option key={key} value={key}>
                {SECTION_LABELS[key]}
                {draft.sections.some((s) => s.kind === key)
                  ? " (already added)"
                  : ""}
              </option>
            ))}
        </select>
        <Button
          variant="outline"
          size="sm"
          disabled={!editable}
          onClick={() => {
            onAddSection(kind);
          }}
        >
          <Plus size={14} /> Add section
        </Button>
      </div>
    </div>
  );
}

function NumberSetting({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="rf-number-setting">
      <span>
        {label}
        <output>{value}</output>
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          onChange(Number(e.target.value));
        }}
      />
    </label>
  );
}

export function DesignPanel({
  appearance,
  onChange,
}: {
  appearance: EditorAppearance;
  onChange: (value: EditorAppearance) => void;
}) {
  const [gallery, setGallery] = useState(false);
  const changeType = (
    role: TypeRole,
    patch: Partial<EditorAppearance["typography"][TypeRole]>,
  ) => {
    const next = structuredClone(appearance);
    Object.assign(next.typography[role], patch);
    onChange(next);
  };
  return (
    <div className="rf-design-tools">
      <p className="rf-tool-hint">
        Save changes stores formatting with this resume. Zoom changes only the
        view.
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          onChange(structuredClone(DEFAULT_APPEARANCE));
        }}
      >
        Reset to default
      </Button>
      <details className="rf-tool-disclosure" open>
        <summary>Choose a template</summary>
        <p>Forge Classic</p>
        <span className="rf-tool-hint">One original layout is available.</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setGallery(true);
          }}
        >
          View template
        </Button>
      </details>
      <details className="rf-tool-disclosure">
        <summary>Pre-built layouts</summary>
        <p className="rf-tool-hint">
          Spacing presets keep every word of your resume.
        </p>
        <div className="rf-density-options">
          {(["compact", "balanced", "spacious"] as const).map((name) => (
            <Button
              key={name}
              size="sm"
              variant="outline"
              onClick={() => {
                onChange(appearancePreset(name));
              }}
            >
              {name.charAt(0).toUpperCase() + name.slice(1)}
            </Button>
          ))}
        </div>
      </details>
      <details className="rf-tool-disclosure">
        <summary>Padding & spacing</summary>
        {(
          Object.keys(APPEARANCE_BOUNDS) as (keyof typeof APPEARANCE_BOUNDS)[]
        ).map((key) => {
          const labels = {
            sectionGap: "Section gap (px)",
            itemGap: "Entry gap (px)",
            top: "Top margin (px)",
            right: "Right margin (px)",
            bottom: "Bottom margin (px)",
            left: "Left margin (px)",
          };
          return (
            <NumberSetting
              key={key}
              label={labels[key]}
              value={appearance[key]}
              min={APPEARANCE_BOUNDS[key][0]}
              max={APPEARANCE_BOUNDS[key][1]}
              onChange={(value) => {
                onChange({ ...appearance, [key]: value });
              }}
            />
          );
        })}
        <p className="rf-tool-hint">
          On small screens, side margins adapt to keep text readable.
        </p>
      </details>
      <details className="rf-tool-disclosure">
        <summary>Text size & styles</summary>
        {(Object.keys(TYPE_ROLES) as TypeRole[]).map((role) => (
          <fieldset className="rf-type-setting" key={role}>
            <legend>{TYPE_ROLES[role]}</legend>
            <label>
              Font
              <select
                aria-label={`${TYPE_ROLES[role]} font`}
                value={appearance.typography[role].font}
                onChange={(e) => {
                  changeType(role, {
                    font: e.target.value as keyof typeof PAPER_FONTS,
                  });
                }}
              >
                {Object.keys(PAPER_FONTS).map((font) => (
                  <option key={font} value={font}>
                    {font === "Times" ? "Times New Roman" : font}
                  </option>
                ))}
              </select>
            </label>
            <NumberSetting
              label={`${TYPE_ROLES[role]} size (px)`}
              value={appearance.typography[role].size}
              min={TYPE_SIZE_BOUNDS[role][0]}
              max={TYPE_SIZE_BOUNDS[role][1]}
              onChange={(size) => {
                changeType(role, { size });
              }}
            />
            <NumberSetting
              label={`${TYPE_ROLES[role]} line height`}
              value={appearance.typography[role].lineHeight}
              min={1.2}
              max={1.8}
              step={0.05}
              onChange={(lineHeight) => {
                changeType(role, { lineHeight });
              }}
            />
            <label>
              Color
              <select
                aria-label={`${TYPE_ROLES[role]} color`}
                value={appearance.typography[role].color}
                onChange={(e) => {
                  changeType(role, {
                    color: e.target.value as (typeof PAPER_COLORS)[number],
                  });
                }}
              >
                {PAPER_COLORS.map((color, i) => (
                  <option key={color} value={color}>
                    {["Ink", "Blue", "Indigo"][i]}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>
        ))}
      </details>
      <p className="rf-tool-hint">
        More templates and PDF export are not available yet.
      </p>
      <Dialog
        open={gallery}
        onOpenChange={setGallery}
        title="Choose a template"
        description="The current local editor has one original template. More layouts will be added later."
      >
        <div className="rf-template-card">
          <div className="rf-template-mini" aria-hidden="true">
            <strong>Alex Rivera</strong>
            <i>Example professional headline</i>
            {["Summary", "Experience", "Education", "Projects", "Skills"].map(
              (name) => (
                <div key={name}>
                  <b>{name}</b>
                  <span />
                  <span />
                </div>
              ),
            )}
          </div>
          <div>
            <strong>Forge Classic</strong>
            <p>Centered header, serif text and a single column.</p>
            <span>Current template</span>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

export function AtsPanel() {
  const [filter, setFilter] = useState<"Pending" | "Completed" | "Deleted">(
    "Pending",
  );
  return (
    <div className="rf-service-tools">
      <section
        className="rf-ats-readiness"
        aria-labelledby="rf-ats-meter-heading"
      >
        <div className="rf-ats-meter-heading">
          <h3 id="rf-ats-meter-heading">Resume readiness</h3>
          <span className="rf-ats-status">Not evaluated</span>
        </div>
        <div className="rf-ats-score-value" aria-label="ATS score unavailable">
          <span aria-hidden="true">—</span>
          <span> / 100</span>
        </div>
        <div
          className="rf-ats-scale"
          role="img"
          aria-label="ATS score not evaluated. Scale from 0 to 100."
        >
          <div className="rf-ats-track" />
          <div className="rf-ats-ticks" aria-hidden="true">
            {[0, 25, 50, 75, 100].map((tick) => (
              <span key={tick}>{tick}</span>
            ))}
          </div>
        </div>
        <p id="rf-ats-unavailable">
          Your resume has no score yet. ATS evaluation is not available yet.
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled
          aria-describedby="rf-ats-unavailable"
        >
          Run ATS check
        </Button>
      </section>
      <h3>Suggested actions</h3>
      <div className="rf-issue-filters" aria-label="Suggested action status">
        {(["Pending", "Completed", "Deleted"] as const).map((name) => (
          <button
            key={name}
            type="button"
            aria-pressed={filter === name}
            onClick={() => {
              setFilter(name);
            }}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="rf-panel-empty" role="status">
        <strong>{filter} actions unavailable</strong>
        <p>
          Suggestions will appear after an ATS evaluation. Your saved resume
          content stays unchanged.
        </p>
      </div>
    </div>
  );
}
export function JdPanel() {
  const [composing, setComposing] = useState(false);
  const [description, setDescription] = useState("");
  return (
    <div className="rf-service-tools">
      <div className="rf-panel-empty">
        <Briefcase size={30} aria-hidden="true" />
        <h3>No job analyses yet</h3>
        <p>
          Add a job description to prepare an analysis. AI tailoring and saved
          analysis history are not connected.
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setComposing(!composing);
        }}
      >
        {composing ? "Close job description" : "Add job description"}
      </Button>
      {composing ? (
        <div className="rf-jd-composer">
          <label htmlFor="rf-editor-jd">Job description</label>
          <textarea
            id="rf-editor-jd"
            maxLength={12000}
            value={description}
            placeholder="Paste a job description here"
            onChange={(e) => {
              setDescription(e.target.value);
            }}
          />
          <p className="rf-tool-hint">
            Local text only; it is not sent or saved and clears when you switch
            tools or leave.
          </p>
          <Button size="sm" disabled aria-describedby="rf-jd-limit">
            Analyze for this JD
          </Button>
          <p id="rf-jd-limit" className="rf-tool-hint">
            Requires AI setup and a saved resume version.
          </p>
        </div>
      ) : null}
    </div>
  );
}
