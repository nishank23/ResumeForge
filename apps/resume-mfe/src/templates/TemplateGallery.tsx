import { Button, Dialog } from "@resume-forge/shared";
import { PAPER_FONTS, type EditorAppearance } from "../editor-appearance";
import {
  RESUME_TEMPLATES,
  matchingTemplate,
  templateAppearance,
} from "./registry";
import "./templates.css";

export function TemplateGallery({
  open,
  onOpenChange,
  appearance,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appearance: EditorAppearance;
  onSelect: (appearance: EditorAppearance) => void;
}) {
  const current = matchingTemplate(appearance);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Choose a template"
      description={`${String(RESUME_TEMPLATES.length)} original styles. Keep every section and every word; save when you’re ready.`}
      className="rf-template-gallery"
      bodyClassName="rf-template-gallery-body"
      footerClassName="rf-template-gallery-footer"
      footer={
        <Button
          variant="outline"
          onClick={() => {
            onOpenChange(false);
          }}
        >
          Done
        </Button>
      }
    >
      <div className="rf-template-grid">
        {RESUME_TEMPLATES.map((template) => {
          const selected = current?.id === template.id;
          const type = template.appearance.typography;
          return (
            <article
              className="rf-template-option"
              key={template.id}
              data-selected={selected}
            >
              <div
                className="rf-template-sheet"
                aria-hidden="true"
                style={{
                  fontFamily: PAPER_FONTS[type.body.font],
                  padding: `${String(template.appearance.top / 3)}px ${String(template.appearance.left / 3)}px`,
                }}
              >
                <strong>Alex Rivera</strong>
                <i>Software Engineer</i>
                {[
                  "Profile",
                  "Experience",
                  "Projects",
                  "Education",
                  "Skills",
                ].map((name) => (
                  <div
                    key={name}
                    style={{ marginTop: template.appearance.sectionGap / 3 }}
                  >
                    <b
                      style={{
                        color: type.section.color,
                        fontFamily: PAPER_FONTS[type.section.font],
                      }}
                    >
                      {name}
                    </b>
                    <span />
                    <span />
                  </div>
                ))}
              </div>
              <div className="rf-template-info">
                <small>{template.category}</small>
                <h3>{template.name}</h3>
                <p>{template.description}</p>
                <Button
                  variant={selected ? "secondary" : "outline"}
                  size="sm"
                  aria-pressed={selected}
                  onClick={() => {
                    const next = templateAppearance(template.id);
                    if (next) onSelect(next);
                  }}
                >
                  {selected
                    ? `${template.name} selected`
                    : `Use ${template.name}`}
                </Button>
              </div>
            </article>
          );
        })}
      </div>
      <p className="rf-template-note" role="status">
        {current
          ? `${current.name} in your draft.`
          : "Custom formatting in your draft."}{" "}
        Save changes stores this appearance; Cancel or Undo restores the
        previous one.
      </p>
    </Dialog>
  );
}
