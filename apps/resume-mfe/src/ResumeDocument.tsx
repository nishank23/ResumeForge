import type { HTMLAttributes, KeyboardEvent } from "react";
import { Mail, MapPin, Phone } from "lucide-react";
import { SummaryEditor, type SummaryDocument } from "@resume-forge/shared";
import {
  formatDates,
  richTextPlain,
  safeLink,
  sameTarget,
  type DraftTarget,
  type InlineField,
  type ResumeDraft,
} from "./editor-draft";
import { InlineResumeText } from "./InlineResumeText";

export interface ResumeDocumentProps {
  draft: ResumeDraft;
  selected: DraftTarget;
  editable: boolean;
  onPending: (pending: boolean) => void;
  onSelect: (target: DraftTarget) => void;
  onHover: (target: DraftTarget) => void;
  onHoverExit: () => void;
  onEdit: (target: DraftTarget) => void;
  onActions: () => void;
  onInlineCommit: (
    target: DraftTarget,
    field: InlineField,
    text: string,
  ) => boolean;
  onRichChange: (target: DraftTarget, value: SummaryDocument) => void;
}
export function ResumeDocument({
  draft,
  selected,
  editable,
  onPending,
  onSelect,
  onHover,
  onHoverExit,
  onEdit,
  onActions,
  onInlineCommit,
  onRichChange,
}: ResumeDocumentProps) {
  const region = (
    target: DraftTarget,
    label: string,
    hidden = false,
  ): HTMLAttributes<HTMLElement> & { "data-editor-target"?: string } =>
    editable
      ? {
          tabIndex: 0,
          role: "group",
          "aria-label": `${label}${hidden ? ", hidden in preview" : ""}. Alt Enter edits details; Escape focuses actions.`,
          "data-editor-target": JSON.stringify(target),
          className: `rf-paper-selectable${sameTarget(selected, target) ? " is-selected" : ""}${hidden ? " is-hidden" : ""}`,
          onMouseEnter: () => {
            onHover(target);
          },
          onClick: (event) => {
            event.stopPropagation();
            onSelect(target);
          },
          onFocus: (event) => {
            if (event.target === event.currentTarget) onSelect(target);
          },
          onKeyDown: (event) => {
            if (event.key === "Enter" && event.altKey) {
              event.preventDefault();
              event.stopPropagation();
              onEdit(target);
            } else if (
              event.target === event.currentTarget &&
              (event.key === "Enter" || event.key === " ")
            ) {
              event.preventDefault();
              event.stopPropagation();
              onSelect(target);
              onActions();
            } else if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              onActions();
            }
          },
        }
      : {};
  const text = (
    target: DraftTarget,
    field: InlineField,
    value: string,
    label: string,
    placeholder: string,
    live = editable,
  ) => (
    <InlineResumeText
      value={value}
      label={label}
      placeholder={placeholder}
      editable={live}
      onPending={onPending}
      onSelect={() => {
        onSelect(target);
      }}
      onCommit={(value) => onInlineCommit(target, field, value)}
      onEdit={() => {
        onEdit(target);
      }}
      onActions={onActions}
    />
  );
  const header: DraftTarget = { type: "header" };
  const name = [draft.header.firstName, draft.header.lastName]
    .filter(Boolean)
    .join(" ");
  const location = [draft.header.city, draft.header.state, draft.header.country]
    .filter(Boolean)
    .join(", ");
  const headerProps = region(header, "Name and contact details");
  return (
    <article
      className="rf-resume-document"
      onMouseLeave={onHoverExit}
      aria-label={`Resume for ${name || "unnamed person"}`}
    >
      <header
        {...headerProps}
        data-editor-header
        className={`rf-resume-header ${headerProps.className ?? ""}`}
      >
        <h2>
          {text(
            header,
            "firstName",
            draft.header.firstName,
            "First name on resume",
            "[First name]",
          )}
          <span> </span>
          {text(
            header,
            "lastName",
            draft.header.lastName,
            "Last name on resume",
            "[Last name]",
          )}
        </h2>
        {editable || draft.header.headline ? (
          <p className="rf-resume-headline">
            {text(
              header,
              "headline",
              draft.header.headline,
              "Professional headline on resume",
              "[Professional headline]",
            )}
          </p>
        ) : null}
        <ul className="rf-resume-contacts">
          {editable || draft.sampleContact.phone ? (
            <li>
              <Phone size={11} aria-hidden="true" />
              {text(
                header,
                "phone",
                draft.sampleContact.phone,
                "Phone number on resume",
                "[Phone number]",
              )}
            </li>
          ) : null}
          {editable || draft.sampleContact.email ? (
            <li>
              <Mail size={11} aria-hidden="true" />
              {text(
                header,
                "email",
                draft.sampleContact.email,
                "Email on resume",
                "[Email]",
              )}
            </li>
          ) : null}
          {editable || location ? (
            <li>
              <MapPin size={11} aria-hidden="true" />
              <span className="rf-inline-location">
                {(["city", "state", "country"] as const)
                  .filter((field) => editable || draft.header[field])
                  .map((field, i) => (
                    <span key={field}>
                      {i > 0 ? ", " : ""}
                      {text(
                        header,
                        field,
                        draft.header[field],
                        `${field.charAt(0).toUpperCase()}${field.slice(1)} on resume`,
                        `[${field}]`,
                      )}
                    </span>
                  ))}
              </span>
            </li>
          ) : null}
          {(draft.header.links ?? [])
            .filter((link) => safeLink(link.url))
            .map((link) => (
              <li key={link.id}>
                <a href={link.url} target="_blank" rel="noopener noreferrer">
                  {link.label || link.url}
                </a>
              </li>
            ))}
        </ul>
      </header>
      {draft.sections
        .filter((s) => editable || !s.hidden)
        .map((section) => {
          const target: DraftTarget = {
            type: "section",
            sectionId: section.id,
          };
          const dialogOnly = section.kind === "skills";
          const props =
            dialogOnly && editable
              ? {
                  tabIndex: 0,
                  role: "button",
                  "aria-label": `Edit ${section.label}`,
                  "data-editor-target": JSON.stringify(target),
                  "data-skills-dialog": true,
                  className: `rf-paper-selectable rf-skills-clickable${sameTarget(selected, target) ? " is-selected" : ""}${section.hidden ? " is-hidden" : ""}`,
                  onMouseEnter: () => {
                    onHover(target);
                  },
                  onFocus: () => {
                    onSelect(target);
                  },
                  onClick: () => {
                    onEdit(target);
                  },
                  onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      onEdit(target);
                    }
                  },
                }
              : region(target, section.label, section.hidden);
          const live = editable && !section.hidden;
          return (
            <section
              {...props}
              key={section.id}
              data-editor-section={section.id}
              className={`rf-resume-section ${props.className ?? ""}`}
              aria-labelledby={
                dialogOnly && editable ? undefined : `paper-${section.id}`
              }
            >
              <h3 id={`paper-${section.id}`}>
                {dialogOnly
                  ? section.label
                  : text(
                      target,
                      "sectionLabel",
                      section.label,
                      `${section.label} heading on resume`,
                      "[Section heading]",
                      live,
                    )}
              </h3>
              {section.kind === "summary" ? (
                <SummaryEditor
                  value={section.summary}
                  label="Professional summary on resume page"
                  editable={live}
                  onFocus={() => {
                    onSelect(target);
                  }}
                  onChange={(value) => {
                    onRichChange(target, value);
                  }}
                />
              ) : null}
              {["experience", "education", "projects"].includes(section.kind)
                ? section.entries
                    .filter((e) => editable || !e.hidden)
                    .map((entry) => {
                      const entryTarget: DraftTarget = {
                        type: "entry",
                        sectionId: section.id,
                        itemId: entry.id,
                      };
                      const entryProps = region(
                        entryTarget,
                        entry.title || "New entry",
                        entry.hidden,
                      );
                      const entryLive = live && !entry.hidden;
                      return (
                        <div
                          {...entryProps}
                          key={entry.id}
                          data-editor-entry={entry.id}
                          className={`rf-resume-entry ${entryProps.className ?? ""}`}
                        >
                          <div className="rf-resume-entry-heading">
                            <h4>
                              {text(
                                entryTarget,
                                "title",
                                entry.title,
                                `${section.kind === "education" ? "Institution" : section.kind === "projects" ? "Project" : "Job"} title on resume`,
                                "[Add title]",
                                entryLive,
                              )}
                              {entry.employmentType ? (
                                <>
                                  {" "}
                                  |{" "}
                                  {text(
                                    entryTarget,
                                    "employmentType",
                                    entry.employmentType,
                                    "Employment type on resume",
                                    "[Employment type]",
                                    entryLive,
                                  )}
                                </>
                              ) : null}
                            </h4>
                            <p
                              className="rf-resume-period"
                              title={
                                editable
                                  ? "Alt Enter or Edit opens date fields"
                                  : undefined
                              }
                              onDoubleClick={() => {
                                if (editable) onEdit(entryTarget);
                              }}
                            >
                              {formatDates(entry.dates) ||
                                (editable ? "[Add dates in Edit]" : "")}
                            </p>
                          </div>
                          <div className="rf-resume-entry-subheading">
                            <p>
                              {text(
                                entryTarget,
                                "subtitle",
                                entry.subtitle,
                                `${section.kind === "education" ? "Degree" : section.kind === "projects" ? "Project role" : "Company"} on resume`,
                                "[Add details]",
                                entryLive,
                              )}
                              {entry.fieldOfStudy ? (
                                <>
                                  {" "}
                                  ·{" "}
                                  {text(
                                    entryTarget,
                                    "fieldOfStudy",
                                    entry.fieldOfStudy,
                                    "Field of study on resume",
                                    "[Field of study]",
                                    entryLive,
                                  )}
                                </>
                              ) : null}
                            </p>
                            <p>
                              {entry.locationType ? (
                                <>
                                  {text(
                                    entryTarget,
                                    "locationType",
                                    entry.locationType,
                                    "Location type on resume",
                                    "[Location type]",
                                    entryLive,
                                  )}{" "}
                                  ·{" "}
                                </>
                              ) : null}
                              {entry.location
                                ? text(
                                    entryTarget,
                                    "location",
                                    entry.location,
                                    "Entry location on resume",
                                    "[Location]",
                                    entryLive,
                                  )
                                : null}
                            </p>
                          </div>
                          {entry.grade ? (
                            <p className="rf-resume-grade">
                              Grade:{" "}
                              {text(
                                entryTarget,
                                "grade",
                                entry.grade,
                                "Grade on resume",
                                "[Grade]",
                                entryLive,
                              )}
                            </p>
                          ) : null}
                          {richTextPlain(entry.description).trim() ? (
                            <div className="rf-entry-description">
                              <SummaryEditor
                                value={entry.description}
                                label={`${entry.title || "New entry"} description on resume`}
                                editable={entryLive}
                                onFocus={() => {
                                  onSelect(entryTarget);
                                }}
                                onChange={(value) => {
                                  onRichChange(entryTarget, value);
                                }}
                              />
                            </div>
                          ) : null}
                          {entry.bullets.some(
                            (b) => b.text && (editable || !b.hidden),
                          ) ? (
                            <ul className="rf-resume-bullets">
                              {entry.bullets
                                .filter(
                                  (b) => b.text && (editable || !b.hidden),
                                )
                                .map((bullet, i) => {
                                  const bulletTarget: DraftTarget = {
                                    type: "bullet",
                                    sectionId: section.id,
                                    entryId: entry.id,
                                    itemId: bullet.id,
                                  };
                                  return (
                                    <li
                                      {...region(
                                        bulletTarget,
                                        `Achievement ${String(i + 1)}`,
                                        bullet.hidden,
                                      )}
                                      key={bullet.id}
                                    >
                                      {text(
                                        bulletTarget,
                                        "text",
                                        bullet.text,
                                        `${entry.title} achievement ${String(i + 1)} on resume`,
                                        "[Achievement]",
                                        entryLive && !bullet.hidden,
                                      )}
                                    </li>
                                  );
                                })}
                            </ul>
                          ) : null}
                          {entry.technologies ? (
                            <p className="rf-resume-technologies">
                              <strong>Technologies / tools used:</strong>{" "}
                              {text(
                                entryTarget,
                                "technologies",
                                entry.technologies,
                                `${entry.title} technologies on resume`,
                                "[Technologies / tools]",
                                entryLive,
                              )}
                            </p>
                          ) : null}
                          {entry.links.some((link) =>
                            safeLink(link.url.trim()),
                          ) ? (
                            <p className="rf-resume-links">
                              {entry.links
                                .filter((link) => safeLink(link.url.trim()))
                                .map((link) => (
                                  <a
                                    href={link.url.trim()}
                                    key={link.id}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                    }}
                                  >
                                    {link.label || "Project link"}
                                  </a>
                                ))}
                            </p>
                          ) : null}
                        </div>
                      );
                    })
                : null}
              {section.kind === "skills" ? (
                <dl className="rf-resume-skills">
                  {section.groups
                    .filter((g) =>
                      g.items.some((i) => i.text && (editable || !i.hidden)),
                    )
                    .map((group) => (
                      <div key={group.id}>
                        <dt>{group.label}:</dt>
                        <dd>
                          {group.items
                            .filter((i) => i.text && (editable || !i.hidden))
                            .map((item) => item.text)
                            .join(", ")}
                        </dd>
                      </div>
                    ))}
                  {section.languages.some(
                    (i) => i.text && (editable || !i.hidden),
                  ) ? (
                    <div>
                      <dt>Languages:</dt>
                      <dd>
                        {section.languages
                          .filter((i) => i.text && (editable || !i.hidden))
                          .map(
                            (item) =>
                              `${item.text}${item.proficiency ? ` (${item.proficiency})` : ""}`,
                          )
                          .join(", ")}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}
              {section.kind === "languages" ? (
                <p className="rf-resume-languages">
                  {section.languages
                    .filter((i) => i.text && (editable || !i.hidden))
                    .map((item, i) => {
                      const itemTarget: DraftTarget = {
                        type: "language",
                        sectionId: section.id,
                        itemId: item.id,
                      };
                      return (
                        <span key={item.id}>
                          {i > 0 ? "; " : ""}
                          <span {...region(itemTarget, item.text, item.hidden)}>
                            {text(
                              itemTarget,
                              "text",
                              item.text,
                              `Language ${String(i + 1)} on resume`,
                              "[Language]",
                              live && !item.hidden,
                            )}
                            {editable || item.proficiency ? (
                              <>
                                {" "}
                                (
                                {text(
                                  itemTarget,
                                  "proficiency",
                                  item.proficiency,
                                  `${item.text} proficiency on resume`,
                                  "[Proficiency]",
                                  live && !item.hidden,
                                )}
                                )
                              </>
                            ) : null}
                          </span>
                        </span>
                      );
                    })}
                </p>
              ) : null}
              {editable &&
              section.kind !== "summary" &&
              !section.entries.length &&
              !section.groups.some((g) => g.items.length) &&
              !section.languages.length ? (
                <p className="rf-empty-paper">
                  Choose Edit to add your details to this section.
                </p>
              ) : null}
            </section>
          );
        })}
    </article>
  );
}
