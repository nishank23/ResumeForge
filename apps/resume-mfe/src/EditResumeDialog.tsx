import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import {
  Controller,
  FormProvider,
  useFieldArray,
  useForm,
  useFormContext,
  type Path,
} from "react-hook-form";
import { ArrowDown, ArrowUp, Plus, Redo2, Trash2, Undo2 } from "lucide-react";
import {
  Button,
  Dialog,
  FormField,
  Input,
  SummaryEditor,
  StatusBanner,
  Textarea,
} from "@resume-forge/shared";
import { SkillsEditorFields } from "./SkillsEditorFields";
import { createHistory, editorHistory, isDirty } from "./editor-history";
import {
  formValues,
  fillEmptyForm,
  projectForm,
  validateForm,
  type EditorFormValues,
} from "./editor-form";
import {
  sectionFor,
  targetLabel,
  type DraftTarget,
  type ResumeDraft,
} from "./editor-draft";

const newId = () => crypto.randomUUID();
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function TextField({
  name,
  label,
  required = false,
  multiline = false,
  initial = false,
  disabled = false,
}: {
  name: Path<EditorFormValues>;
  label: string;
  required?: boolean;
  multiline?: boolean;
  initial?: boolean;
  disabled?: boolean;
}) {
  const { register, getFieldState, formState } =
    useFormContext<EditorFormValues>();
  const error = getFieldState(name, formState).error?.message;
  return (
    <FormField label={label} required={required} error={error}>
      {(props) =>
        multiline ? (
          <Textarea {...props} {...register(name)} rows={3} />
        ) : (
          <Input
            {...props}
            {...register(name)}
            disabled={disabled}
            data-modal-initial-focus={initial || undefined}
          />
        )
      }
    </FormField>
  );
}
export interface EditResumeDialogProps {
  sample: ResumeDraft;
  base: ResumeDraft;
  target: DraftTarget;
  onPreview: (draft: ResumeDraft) => void;
  onSave: (draft: ResumeDraft) => void;
  onCancel: () => void;
}
export function EditResumeDialog({
  sample,
  base,
  target,
  onPreview,
  onSave,
  onCancel,
}: EditResumeDialogProps) {
  const [defaults] = useState(() => formValues(base, target));
  const form = useForm<EditorFormValues>({ defaultValues: defaults });
  const history = useRef(createHistory(defaults));
  const [revision, setRevision] = useState(0);
  const [closing, setClosing] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const onError = (message: string) => {
    setDialogError(message);
  };
  const formId = useId();
  const section = sectionFor(base, target);
  const values = form.watch();
  const serialized = JSON.stringify(values);
  const bullets = useFieldArray({
    control: form.control,
    name: "entry.bullets",
  });
  const links = useFieldArray({ control: form.control, name: "entry.links" });
  const languages = useFieldArray({ control: form.control, name: "languages" });
  useEffect(() => {
    const snapshot = JSON.parse(serialized) as EditorFormValues;
    history.current = editorHistory(history.current, {
      type: "edit",
      value: snapshot,
    });
    setRevision((r) => r + 1);
    onPreview(projectForm(base, target, snapshot));
  }, [serialized, base, target, onPreview]);
  const dirty = isDirty(history.current);
  const close = () => {
    if (dirty) setClosing(true);
    else onCancel();
  };
  const travel = (type: "undo" | "redo") => {
    history.current = editorHistory(history.current, { type });
    form.reset(structuredClone(history.current.current), {
      keepDefaultValues: true,
    });
    setRevision((r) => r + 1);
  };
  const submit = form.handleSubmit((candidate) => {
    form.clearErrors();
    const issues = validateForm(base, target, candidate);
    if (issues.length) {
      issues.forEach((issue) => {
        form.setError(issue.path as Path<EditorFormValues>, {
          type: "validate",
          message: issue.message,
        });
      });
      form.setFocus(issues[0]?.path as Path<EditorFormValues>);
      onError("Please correct the highlighted fields before saving.");
      return;
    }
    onSave(projectForm(base, target, candidate));
  });
  const current = values.entry.dates.current;
  const yearOnly = values.entry.dates.yearOnly;
  const label = targetLabel(base, target);
  const displayLabel = label.length > 120 ? `${label.slice(0, 120)}…` : label;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title={section?.kind === "skills" ? "Skills" : `Edit ${displayLabel}`}
      description={
        section?.kind === "skills"
          ? "Synthetic local draft. Save applies changes; Cancel restores the previous skills."
          : "Synthetic local draft · Changes appear on the page; Save applies them to this draft."
      }
      className={`rf-edit-dialog${section?.kind === "skills" ? " rf-skills-dialog" : ""}`}
      bodyClassName="rf-edit-dialog-body"
      footerClassName="rf-edit-dialog-footer"
      footer={
        closing ? (
          <>
            <Button
              variant="outline"
              onClick={() => {
                setClosing(false);
              }}
            >
              Keep editing
            </Button>
            <Button variant="destructive" onClick={onCancel}>
              Discard changes
            </Button>
          </>
        ) : (
          <>
            <span className="rf-dialog-save-note">
              {dirty ? "Unsaved changes" : "No changes"}
            </span>
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                void submit();
              }}
            >
              Save changes
            </Button>
          </>
        )
      }
    >
      {dialogError ? (
        <StatusBanner
          tone="error"
          title={dialogError}
          onDismiss={() => {
            setDialogError(null);
          }}
        />
      ) : null}
      {closing ? (
        <div className="rf-discard-notice" role="alert">
          Discard changes to {label}? The previous draft will be restored.
        </div>
      ) : null}
      <FormProvider {...form}>
        <form
          id={formId}
          noValidate
          onSubmit={(event) => {
            void submit(event);
          }}
          className="rf-editor-form"
          data-history-revision={revision}
          onKeyDown={(event) => {
            if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
            const key = event.key.toLowerCase();
            if (key === "s") {
              event.preventDefault();
              event.stopPropagation();
              void submit();
            }
            if (key === "z" || key === "y") {
              event.preventDefault();
              event.stopPropagation();
              travel(key === "y" || event.shiftKey ? "redo" : "undo");
            }
          }}
        >
          <div className="rf-sample-fill">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const candidate = fillEmptyForm(
                  form.getValues(),
                  target,
                  section?.kind,
                  sample,
                  newId,
                );
                form.reset(candidate, { keepDefaultValues: true });
                form.clearErrors();
                setDialogError(null);
              }}
            >
              Auto-fill sample details
            </Button>
            <p>
              Fills empty fields with fictional demo details. Your typed content
              is kept; Undo or Cancel removes the examples.
            </p>
          </div>
          <div className="rf-dialog-history">
            <Button
              variant="outline"
              size="sm"
              disabled={!history.current.past.length}
              onClick={() => {
                travel("undo");
              }}
            >
              <Undo2 size={14} /> Undo
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!history.current.future.length}
              onClick={() => {
                travel("redo");
              }}
            >
              <Redo2 size={14} /> Redo
            </Button>
            <span>Changes stay here until saved.</span>
          </div>
          {target.type === "header" ? (
            <>
              <TextField name="title" label="Resume title" required initial />
              <div className="rf-form-grid">
                <TextField
                  name="header.firstName"
                  label="First name"
                  required
                />
                <TextField name="header.lastName" label="Last name" />
              </div>
              <TextField name="header.headline" label="Professional headline" />
              <fieldset className="rf-form-group">
                <legend>Contact details</legend>
                <p className="rf-field-hint">
                  Demo contact fields only. Nothing is sent to a server or AI.
                </p>
                <div className="rf-form-grid">
                  <TextField name="sampleContact.phone" label="Phone number" />
                  <TextField name="sampleContact.email" label="Email" />
                </div>
                <div className="rf-form-grid">
                  <TextField name="header.city" label="City" />
                  <TextField name="header.state" label="State" />
                  <TextField name="header.country" label="Country" />
                </div>
              </fieldset>
            </>
          ) : target.type === "entry" ? (
            <>
              <div className="rf-form-grid">
                <TextField
                  name="entry.title"
                  label={
                    section?.kind === "education"
                      ? "Institution name"
                      : section?.kind === "projects"
                        ? "Project name"
                        : "Job title"
                  }
                  required
                  initial
                />
                <TextField
                  name="entry.subtitle"
                  label={
                    section?.kind === "education"
                      ? "Degree"
                      : section?.kind === "projects"
                        ? "Role"
                        : "Company / organization"
                  }
                  required={section?.kind !== "projects"}
                />
              </div>
              <div className="rf-form-grid">
                <TextField name="entry.location" label="Location" />
                {section?.kind === "experience" ? (
                  <>
                    <TextField
                      name="entry.employmentType"
                      label="Employment type"
                    />
                    <TextField
                      name="entry.locationType"
                      label="Location type"
                    />
                  </>
                ) : null}
                {section?.kind === "education" ? (
                  <>
                    <TextField
                      name="entry.fieldOfStudy"
                      label="Field of study"
                    />
                    <TextField
                      name="entry.grade"
                      label="Grade / CGPA (optional)"
                    />
                  </>
                ) : null}
              </div>
              <fieldset className="rf-form-group">
                <legend>Dates</legend>
                <div className="rf-form-grid">
                  {(["start", "end"] as const).map((side) => (
                    <div key={side} className="rf-form-grid rf-date-pair">
                      <FormField
                        label={`${side === "start" ? "Start" : "End"} month`}
                      >
                        {(props) => (
                          <select
                            {...props}
                            {...form.register(`entry.dates.${side}Month`)}
                            disabled={yearOnly || (side === "end" && current)}
                          >
                            <option value="">Month</option>
                            {MONTHS.map((month, i) => (
                              <option value={String(i + 1)} key={month}>
                                {month}
                              </option>
                            ))}
                          </select>
                        )}
                      </FormField>
                      <TextField
                        name={`entry.dates.${side}Year`}
                        label={`${side === "start" ? "Start" : "End"} year`}
                        disabled={side === "end" && current}
                      />
                    </div>
                  ))}
                </div>
                <label className="rf-checkbox">
                  <input
                    type="checkbox"
                    {...form.register("entry.dates.current", {
                      onChange: (e: ChangeEvent<HTMLInputElement>) => {
                        if (e.target.checked) {
                          form.setValue("entry.dates.endMonth", "");
                          form.setValue("entry.dates.endYear", "");
                        }
                      },
                    })}
                  />
                  {section?.kind === "education"
                    ? "Currently studying here"
                    : "Currently active"}
                </label>
                <label className="rf-checkbox">
                  <input
                    type="checkbox"
                    {...form.register("entry.dates.yearOnly")}
                  />
                  Show years only
                </label>
              </fieldset>
              <fieldset className="rf-form-group">
                <legend>Description</legend>
                <Controller
                  control={form.control}
                  name="entry.description"
                  render={({ field }) => (
                    <SummaryEditor
                      value={field.value}
                      onChange={field.onChange}
                      label="Entry description"
                      toolbar
                    />
                  )}
                />
              </fieldset>
              <fieldset className="rf-form-group">
                <legend>Achievement bullets</legend>
                <p className="rf-field-hint">
                  Add one supported achievement per point.
                </p>
                {bullets.fields.map((bullet, i) => (
                  <div className="rf-bullet-form" key={bullet.id}>
                    <TextField
                      name={
                        `entry.bullets.${String(i)}.text` as Path<EditorFormValues>
                      }
                      label={`Achievement ${String(i + 1)}`}
                      multiline
                    />
                    <div className="rf-inline-actions">
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={`Move achievement ${String(i + 1)} up`}
                        onClick={() => {
                          if (i === 0)
                            onError(
                              "Already at the top of this list. Nothing was moved.",
                            );
                          else bullets.move(i, i - 1);
                        }}
                      >
                        <ArrowUp size={14} />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={`Move achievement ${String(i + 1)} down`}
                        onClick={() => {
                          if (i === bullets.fields.length - 1)
                            onError(
                              "Already at the bottom of this list. Nothing was moved.",
                            );
                          else bullets.move(i, i + 1);
                        }}
                      >
                        <ArrowDown size={14} />
                      </Button>
                      <label className="rf-checkbox">
                        <input
                          type="checkbox"
                          {...form.register(
                            `entry.bullets.${String(i)}.hidden` as Path<EditorFormValues>,
                          )}
                        />
                        Hide in preview
                      </label>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Remove achievement ${String(i + 1)}`}
                        onClick={() => {
                          bullets.remove(i);
                        }}
                      >
                        <Trash2 size={14} /> Remove
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    bullets.append({ id: newId(), text: "", hidden: false });
                  }}
                >
                  <Plus size={14} /> Add achievement
                </Button>
              </fieldset>
              <TextField
                name="entry.technologies"
                label="Technologies / tools used"
              />
              <fieldset className="rf-form-group">
                <legend>Links (optional)</legend>
                {links.fields.map((link, i) => (
                  <div className="rf-link-form" key={link.id}>
                    <div className="rf-form-grid">
                      <TextField
                        name={
                          `entry.links.${String(i)}.label` as Path<EditorFormValues>
                        }
                        label={`Link ${String(i + 1)} label`}
                      />
                      <TextField
                        name={
                          `entry.links.${String(i)}.url` as Path<EditorFormValues>
                        }
                        label={`Link ${String(i + 1)} URL`}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        links.remove(i);
                      }}
                      aria-label={`Remove link ${String(i + 1)}`}
                    >
                      <Trash2 size={14} /> Remove link
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    links.append({ id: newId(), label: "", url: "" });
                  }}
                >
                  <Plus size={14} /> Add link
                </Button>
              </fieldset>
            </>
          ) : target.type === "section" ? (
            <>
              {section?.kind !== "skills" ? (
                <TextField
                  name="label"
                  label="Section heading"
                  required
                  initial
                />
              ) : null}
              {section?.kind === "summary" ? (
                <Controller
                  control={form.control}
                  name="summary"
                  render={({ field }) => (
                    <SummaryEditor
                      value={field.value}
                      onChange={field.onChange}
                      label="Professional summary dialog"
                      toolbar
                    />
                  )}
                />
              ) : null}
              {section?.kind === "skills" ? (
                <SkillsEditorFields onError={onError} />
              ) : null}
              {section?.kind === "languages" ? (
                <fieldset className="rf-form-group">
                  <legend>Languages</legend>
                  {languages.fields.map((language, i) => (
                    <div className="rf-link-form" key={language.id}>
                      <div className="rf-form-grid">
                        <TextField
                          name={
                            `languages.${String(i)}.text` as Path<EditorFormValues>
                          }
                          label={`Language ${String(i + 1)}`}
                          required
                        />
                        <TextField
                          name={
                            `languages.${String(i)}.proficiency` as Path<EditorFormValues>
                          }
                          label={`Language ${String(i + 1)} proficiency`}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          languages.remove(i);
                        }}
                      >
                        <Trash2 size={14} /> Remove language {i + 1}
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      languages.append({
                        id: newId(),
                        text: "",
                        proficiency: "",
                        hidden: false,
                      });
                    }}
                  >
                    <Plus size={14} /> Add language
                  </Button>
                </fieldset>
              ) : null}
              {section &&
              ["experience", "education", "projects"].includes(section.kind) ? (
                <p className="rf-field-hint">
                  Save the heading here. Select an entry on the resume and use
                  its Edit action to change the details.
                </p>
              ) : null}
            </>
          ) : (
            <>
              <TextField
                name="item.text"
                label={
                  target.type === "language"
                    ? "Language"
                    : target.type === "skill"
                      ? "Skill"
                      : "Achievement"
                }
                multiline={target.type === "bullet"}
                required
                initial
              />
              {target.type === "language" ? (
                <TextField name="proficiency" label="Proficiency" />
              ) : null}
            </>
          )}
        </form>
      </FormProvider>
    </Dialog>
  );
}
