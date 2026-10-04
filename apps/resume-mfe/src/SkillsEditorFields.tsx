import { useState, type ReactNode } from "react";
import { useFormContext } from "react-hook-form";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button, FormField, Input } from "@resume-forge/shared";
import type { DraftItem } from "./editor-draft";
import type { EditorFormValues } from "./editor-form";

const SUGGESTIONS: Record<string, string[]> = {
  "programming languages": [
    "C",
    "C++",
    "Go",
    "Rust",
    "Swift",
    "Kotlin",
    "Python",
    "Java",
    "TypeScript",
  ],
  "frameworks & libraries": [
    "React",
    "Next.js",
    "Django",
    "FastAPI",
    "Spring Boot",
    "Vue",
    "Express",
  ],
  "tools & platforms": ["Git", "Docker", "Kubernetes", "Linux", "AWS", "Azure"],
  databases: ["PostgreSQL", "MySQL", "SQLite", "MongoDB", "Redis", "Supabase"],
  "soft skills": [
    "Communication",
    "Problem solving",
    "Collaboration",
    "Leadership",
    "Time management",
  ],
  languages: ["English", "Hindi", "Mandarin", "Japanese", "Spanish", "French"],
};
type TagValue = DraftItem & { proficiency?: string };

function TagCategory({
  label,
  items,
  onChange,
  onError,
  language = false,
  error,
  children,
}: {
  label: string;
  items: TagValue[];
  onChange: (items: TagValue[]) => void;
  onError: (message: string) => void;
  language?: boolean;
  error?: string;
  children?: ReactNode;
}) {
  const [keyword, setKeyword] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const add = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    if (items.length >= 50 || clean.length > 100) {
      onError("Use at most 50 tags per category, each under 100 characters.");
      return;
    }
    if (
      items.some(
        (item) => item.text.trim().toLowerCase() === clean.toLowerCase(),
      )
    ) {
      onError(`${clean} is already in ${label}.`);
      return;
    }
    onChange([
      ...items,
      {
        id: crypto.randomUUID(),
        text: clean,
        hidden: false,
        ...(language ? { proficiency: "" } : {}),
      },
    ]);
    setKeyword("");
  };
  const edit = items.find((item) => item.id === editing);
  const update = (patch: Partial<TagValue>) => {
    onChange(
      items.map((item) => (item.id === editing ? { ...item, ...patch } : item)),
    );
  };
  return (
    <section className="rf-tag-category" aria-label={`${label} category`}>
      <div className="rf-tag-category-heading">
        <h3>{label}</h3>
        {children}
      </div>
      <div className="rf-tag-input">
        {items.map((item) => (
          <span
            key={item.id}
            className={`rf-skill-chip${item.hidden ? " is-hidden" : ""}`}
          >
            <button
              type="button"
              aria-label={`Edit ${item.text || "empty tag"} in ${label}`}
              onClick={() => {
                setEditing(item.id);
              }}
            >
              {item.text || "Empty tag"}
              {item.proficiency ? ` (${item.proficiency})` : ""}
            </button>
            <button
              type="button"
              aria-label={`Remove ${item.text || "empty tag"} from ${label}`}
              onClick={() => {
                onChange(items.filter((value) => value.id !== item.id));
                if (editing === item.id) setEditing(null);
              }}
            >
              <X size={14} />
            </button>
          </span>
        ))}
        <Input
          aria-label={`Add keyword to ${label}`}
          placeholder="Type a keyword and press Enter"
          maxLength={100}
          value={keyword}
          onChange={(event) => {
            setKeyword(event.target.value);
          }}
          onBlur={() => {
            if (keyword.trim()) add(keyword);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.stopPropagation();
              add(keyword);
            }
          }}
        />
      </div>
      {error ? (
        <p className="rf-field-hint" role="alert">
          {error}
        </p>
      ) : null}
      {edit ? (
        <div className="rf-tag-details">
          <FormField label={`${label} tag name`} required>
            {(props) => (
              <Input
                {...props}
                value={edit.text}
                maxLength={100}
                onChange={(event) => {
                  update({ text: event.target.value });
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    setEditing(null);
                  }
                }}
              />
            )}
          </FormField>
          {language ? (
            <FormField
              label={`${edit.text || "Language"} proficiency (optional)`}
            >
              {(props) => (
                <Input
                  {...props}
                  value={edit.proficiency ?? ""}
                  maxLength={100}
                  onChange={(event) => {
                    update({ proficiency: event.target.value });
                  }}
                />
              )}
            </FormField>
          ) : null}
          <label className="rf-checkbox">
            <input
              type="checkbox"
              checked={edit.hidden}
              onChange={(event) => {
                update({ hidden: event.target.checked });
              }}
            />
            Exclude this tag from Preview
          </label>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditing(null);
            }}
          >
            Done editing tag
          </Button>
        </div>
      ) : null}
      <div className="rf-skill-suggestions" aria-label={`${label} suggestions`}>
        {(SUGGESTIONS[label.toLowerCase()] ?? [])
          .filter(
            (text) =>
              !items.some(
                (item) => item.text.trim().toLowerCase() === text.toLowerCase(),
              ),
          )
          .map((text) => (
            <Button
              key={text}
              size="sm"
              variant="outline"
              onClick={() => {
                add(text);
              }}
            >
              <Plus size={14} />
              {text}
            </Button>
          ))}
      </div>
    </section>
  );
}

export function SkillsEditorFields({
  onError,
}: {
  onError: (message: string) => void;
}) {
  const { watch, getValues, setValue, getFieldState, formState } =
    useFormContext<EditorFormValues>();
  const groups = watch("groups"),
    languages = watch("languages");
  const [category, setCategory] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const addCategory = () => {
    const name = category.trim(),
      current = getValues("groups");
    if (
      !name ||
      name.length > 80 ||
      current.length >= 20 ||
      name.toLowerCase() === "languages" ||
      current.some((g) => g.label.trim().toLowerCase() === name.toLowerCase())
    ) {
      onError(
        "Enter a unique category name (up to 80 characters). Languages is already included; at most 20 other categories are allowed.",
      );
      return;
    }
    setValue(
      "groups",
      [...current, { id: crypto.randomUUID(), label: name, items: [] }],
      { shouldDirty: true },
    );
    setCategory("");
  };
  const move = (index: number, direction: number) => {
    const current = [...getValues("groups")],
      next = index + direction;
    if (next < 0 || next >= current.length) {
      onError(
        direction < 0
          ? "This category is already at the highest position."
          : "This category is already at the lowest position.",
      );
      return;
    }
    const from = current[index],
      to = current[next];
    if (!from || !to) return;
    current[index] = to;
    current[next] = from;
    setValue("groups", current, { shouldDirty: true });
  };
  return (
    <div className="rf-skills-manager">
      <div className="rf-create-category">
        <FormField label="Create skill category">
          {(props) => (
            <Input
              {...props}
              data-modal-initial-focus
              maxLength={80}
              placeholder="e.g. Design tools"
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.stopPropagation();
                  addCategory();
                }
              }}
            />
          )}
        </FormField>
        <Button variant="outline" onClick={addCategory}>
          <Plus size={16} />
          Add category
        </Button>
      </div>
      <p className="rf-field-hint">
        Add only skills you have. Suggestions are optional. Spoken languages are
        grouped separately from programming languages below.
      </p>
      {groups.map((group, index) => (
        <div key={group.id}>
          {renaming === group.id ? (
            <FormField
              label={`Rename ${group.label || "category"}`}
              error={
                getFieldState(
                  `groups.${String(index)}.label` as `groups.${number}.label`,
                  formState,
                ).error?.message
              }
            >
              {(props) => (
                <Input
                  {...props}
                  maxLength={80}
                  value={group.label}
                  onChange={(event) => {
                    setValue(
                      `groups.${String(index)}.label` as `groups.${number}.label`,
                      event.target.value,
                      {
                        shouldDirty: true,
                      },
                    );
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      setRenaming(null);
                    }
                  }}
                />
              )}
            </FormField>
          ) : null}
          <TagCategory
            label={group.label || "Unnamed category"}
            items={group.items}
            error={
              getFieldState(
                `groups.${String(index)}.label` as `groups.${number}.label`,
                formState,
              ).error?.message ??
              group.items
                .map(
                  (_, itemIndex) =>
                    getFieldState(
                      `groups.${String(index)}.items.${String(itemIndex)}.text` as `groups.${number}.items.${number}.text`,
                      formState,
                    ).error?.message,
                )
                .find(Boolean)
            }
            onError={onError}
            onChange={(items) => {
              const current = getValues("groups");
              setValue(
                "groups",
                current.map((g) =>
                  g.id === group.id
                    ? {
                        ...g,
                        items: items.map(({ id, text, hidden }) => ({
                          id,
                          text,
                          hidden,
                        })),
                      }
                    : g,
                ),
                { shouldDirty: true },
              );
            }}
          >
            <div className="rf-category-actions">
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Move ${group.label} category up`}
                onClick={() => {
                  move(index, -1);
                }}
              >
                <ArrowUp size={16} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Move ${group.label} category down`}
                onClick={() => {
                  move(index, 1);
                }}
              >
                <ArrowDown size={16} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Rename ${group.label} category`}
                onClick={() => {
                  setRenaming(renaming === group.id ? null : group.id);
                }}
              >
                <Pencil size={16} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${group.label} category`}
                onClick={() => {
                  setDeleting(group.id);
                }}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          </TagCategory>
          {deleting === group.id ? (
            <div className="rf-category-confirm" role="alert">
              <p>
                Delete {group.label} and its {group.items.length} tags from this
                draft?
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setDeleting(null);
                }}
              >
                Keep category
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  setValue(
                    "groups",
                    getValues("groups").filter((g) => g.id !== group.id),
                    { shouldDirty: true },
                  );
                  setDeleting(null);
                }}
              >
                Delete category
              </Button>
            </div>
          ) : null}
        </div>
      ))}
      <TagCategory
        label="Languages"
        items={languages}
        error={languages
          .map(
            (_, index) =>
              getFieldState(
                `languages.${String(index)}.text` as `languages.${number}.text`,
                formState,
              ).error?.message ??
              getFieldState(
                `languages.${String(index)}.proficiency` as `languages.${number}.proficiency`,
                formState,
              ).error?.message,
          )
          .find(Boolean)}
        language
        onError={onError}
        onChange={(items) => {
          setValue(
            "languages",
            items.map((item) => ({
              ...item,
              proficiency: item.proficiency ?? "",
            })),
            { shouldDirty: true },
          );
        }}
      >
        <Button
          variant="ghost"
          size="icon"
          aria-label="Clear Languages tags"
          onClick={() => {
            setDeleting("languages");
          }}
        >
          <Trash2 size={16} />
        </Button>
      </TagCategory>
      {deleting === "languages" ? (
        <div className="rf-category-confirm" role="alert">
          <p>Remove all language tags from this draft?</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setDeleting(null);
            }}
          >
            Keep languages
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              setValue("languages", [], { shouldDirty: true });
              setDeleting(null);
            }}
          >
            Clear languages
          </Button>
        </div>
      ) : null}
    </div>
  );
}
