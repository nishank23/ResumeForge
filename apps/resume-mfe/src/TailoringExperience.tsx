import { useEffect, useRef, useState } from "react";
import { Button } from "@resume-forge/shared";
import {
  tailoringAnswerIssue,
  type EditorDocument,
} from "@resume-forge/shared-types";
import {
  experienceEntries,
  experiencePrompts,
  experienceQuestions,
  previousExperienceQuestions,
  experienceQuestionLabel,
  type ExperienceAnswer,
} from "./tailoring-experience";

type AnswerTarget = Omit<ExperienceAnswer, "text">;
const key = (target: AnswerTarget) =>
  JSON.stringify([target.sectionId, target.itemId, target.kind]);
const questions = [...experienceQuestions, ...previousExperienceQuestions];

export function TailoringExperience({
  doc,
  answers,
  terms,
  disabled,
  onChange,
}: {
  doc: EditorDocument;
  answers: ExperienceAnswer[];
  terms: string[];
  disabled: boolean;
  onChange: (answers: ExperienceAnswer[]) => void;
}) {
  const entries = experienceEntries(doc);
  const prompts = experiencePrompts(doc, terms);
  const [position, setPosition] = useState(0);
  const [editing, setEditing] = useState<AnswerTarget | null>(null);
  const prompt = prompts[position];
  const entry = editing
    ? entries.find(
        (e) => e.sectionId === editing.sectionId && e.itemId === editing.itemId,
      )
    : prompt?.entry;
  const question = editing
    ? questions.find((q) => q.kind === editing.kind)
    : prompt;
  const target =
    entry && question
      ? {
          sectionId: entry.sectionId,
          itemId: entry.itemId,
          kind: question.kind,
        }
      : null;
  const currentKey = target ? key(target) : "done";
  const answer = answers.find((a) => target && key(a) === currentKey);
  const issue = tailoringAnswerIssue(answer?.text ?? "");
  const heading = useRef<HTMLHeadingElement>(null);
  const previousKey = useRef(currentKey);
  useEffect(() => {
    if (previousKey.current !== currentKey) heading.current?.focus();
    previousKey.current = currentKey;
  }, [currentKey]);
  const pending = answers.filter((a) => a.text.trim());
  const update = (text: string) => {
    if (target)
      onChange([
        ...answers.filter((a) => key(a) !== currentKey),
        { ...target, text },
      ]);
  };
  const next = () => {
    if (editing) setEditing(null);
    else setPosition((p) => p + 1);
  };
  if (!entries.length)
    return (
      <p>
        Add an actual work experience or project in the builder to add details.
        You can still tailor saved text.
      </p>
    );
  return (
    <div className="rf-experience-worksheet rf-experience-interview">
      <div className="rf-experience-intro">
        <h3 ref={heading} tabIndex={-1}>
          One useful detail at a time
        </h3>
        <p>
          Only gaps worth clarifying. Up to three optional questions across your
          resume. You can review your facts at any time.
        </p>
      </div>
      {entry && question && target ? (
        <>
          <p className="rf-experience-position" aria-live="polite">
            {editing
              ? "Edit a detail"
              : `Question ${String(position + 1)} of ${String(prompts.length)}`}{" "}
            · Optional
          </p>
          <h4>{entry.title}</h4>
          {!editing && prompt ? (
            <p className="rf-tool-hint">{prompt.reason}</p>
          ) : null}
          <details className="rf-experience-source">
            <summary>Read your saved details</summary>
            <blockquote>
              {entry.description || "No description saved for this entry yet."}
            </blockquote>
            {entry.tools ? (
              <p className="rf-tool-hint">Listed tools: {entry.tools}</p>
            ) : null}
          </details>
          <div className="rf-experience-question" key={currentKey}>
            <label htmlFor="experience-answer">{question.label}</label>
            <p id="experience-answer-hint">{question.hint}</p>
            <textarea
              id="experience-answer"
              aria-describedby={`experience-answer-hint${issue ? " experience-answer-error" : ""}`}
              aria-invalid={!!issue}
              rows={4}
              maxLength={question.kind === "tools" ? 500 : 2000}
              value={answer?.text ?? ""}
              disabled={disabled}
              onChange={(event) => {
                update(event.target.value);
              }}
            />
            {issue ? (
              <p id="experience-answer-error" role="alert">
                {issue}
              </p>
            ) : null}
          </div>
          <div className="rf-experience-question-actions">
            {!editing && position > 0 ? (
              <Button
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => {
                  setPosition((p) => p - 1);
                }}
              >
                Back
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => {
                if (!editing)
                  onChange(answers.filter((a) => key(a) !== currentKey));
                next();
              }}
            >
              {editing ? "Back to questions" : "Skip question"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={disabled || !!issue || !answer?.text.trim()}
              onClick={next}
            >
              {editing
                ? "Done editing"
                : position + 1 < prompts.length
                  ? "Next question"
                  : "Done with questions"}
            </Button>
          </div>
        </>
      ) : (
        <div className="rf-experience-complete" role="status">
          <h4>
            {prompts.length
              ? "That’s all the suggested questions"
              : "Your saved details are ready to tailor"}
          </h4>
          <p>
            {pending.length
              ? "Review the details you added before sending them to Gemini."
              : "No extra answers are required. Continue with your saved facts, or add a detail below."}
          </p>
          {prompts.length ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => {
                setPosition(0);
              }}
            >
              Review questions
            </Button>
          ) : null}
        </div>
      )}
      <p className="rf-tool-hint">
        Keep contacts and links out of answers. Nothing is sent to Gemini until
        you confirm your facts.
      </p>
      {pending.length ? (
        <details className="rf-experience-added">
          <summary>Added details ({pending.length})</summary>
          {pending.map((a) => (
            <div key={key(a)}>
              <strong>
                {
                  entries.find(
                    (e) => e.sectionId === a.sectionId && e.itemId === a.itemId,
                  )?.title
                }
              </strong>
              <p>{experienceQuestionLabel(a.kind)}</p>
              <blockquote>{a.text}</blockquote>
              <Button
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={() => {
                  setEditing({
                    sectionId: a.sectionId,
                    itemId: a.itemId,
                    kind: a.kind,
                  });
                }}
              >
                Edit answer
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={() => {
                  onChange(answers.filter((answer) => key(answer) !== key(a)));
                }}
              >
                Remove answer
              </Button>
            </div>
          ))}
        </details>
      ) : null}
      <details className="rf-experience-extra">
        <summary>Add another detail (optional)</summary>
        <label htmlFor="experience-entry">Role or project</label>
        <select
          id="experience-entry"
          disabled={disabled}
          value={
            editing ? JSON.stringify([editing.sectionId, editing.itemId]) : ""
          }
          onChange={(event) => {
            const chosen = entries.find(
              (e) =>
                JSON.stringify([e.sectionId, e.itemId]) === event.target.value,
            );
            if (chosen)
              setEditing({
                sectionId: chosen.sectionId,
                itemId: chosen.itemId,
                kind: "contribution",
              });
          }}
        >
          <option value="">Choose an entry</option>
          {entries.map((e) => (
            <option
              key={e.itemId}
              value={JSON.stringify([e.sectionId, e.itemId])}
            >
              {e.title}
            </option>
          ))}
        </select>
        {editing ? (
          <>
            <label htmlFor="experience-detail">Detail to add</label>
            <select
              id="experience-detail"
              disabled={disabled}
              value={editing.kind}
              onChange={(event) => {
                const chosen = questions.find(
                  (q) => q.kind === event.target.value,
                );
                if (chosen) setEditing({ ...editing, kind: chosen.kind });
              }}
            >
              {questions
                .filter(
                  (q) =>
                    q.kind === editing.kind ||
                    experienceQuestions.some(
                      (standard) => standard.kind === q.kind,
                    ) ||
                    pending.some(
                      (a) =>
                        a.sectionId === editing.sectionId &&
                        a.itemId === editing.itemId &&
                        a.kind === q.kind,
                    ),
                )
                .map((q) => (
                  <option key={q.kind} value={q.kind}>
                    {q.label}
                  </option>
                ))}
            </select>
          </>
        ) : null}
      </details>
    </div>
  );
}
