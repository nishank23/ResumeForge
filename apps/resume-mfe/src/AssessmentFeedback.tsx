import { CircleCheck, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Button } from "@resume-forge/shared";
import type { ReadinessCheck } from "@resume-forge/resume-core";
import {
  compactCheckGroups,
  readinessGroups,
  readinessRuleGroups,
} from "./readiness-feedback";

const filterLabels = {
  Pending: "Needs attention",
  Completed: "Passed",
  Deleted: "Dismissed",
};

const emptyLabels = {
  Pending: "No actions need attention.",
  Completed: "No passed checks yet.",
  Deleted: "No dismissed actions.",
};

const labels: Record<string, string> = {
  structure: "Structure",
  detail: "Experience & projects",
  skills: "Skills",
  clarity: "Clear achievements",
  dates: "Dates",
};
/** Same compact presentation for readiness and JD; individual rule actions stay scoped. */
export function AssessmentFeedback({
  checks,
  dismissed,
  mode = "areas",
  disabled,
  label,
  onTarget,
  onDismiss,
}: {
  checks: ReadinessCheck[];
  mode?: "areas" | "rules";
  dismissed: string[];
  disabled?: boolean;
  label?: (check: ReadinessCheck) => string;
  onTarget: (check: ReadinessCheck, edit: boolean) => void;
  onDismiss?: (check: ReadinessCheck, dismissed: boolean) => void;
}) {
  const [filter, setFilter] = useState<"Pending" | "Completed" | "Deleted">(
    "Pending",
  );
  const groups = readinessGroups({ checks }, dismissed);
  const rules = readinessRuleGroups(checks, dismissed);
  const compact = compactCheckGroups(groups[filter]);
  const count = (name: typeof filter) =>
    mode === "rules"
      ? rules[name].length
      : compactCheckGroups(groups[name]).length;
  return (
    <section className="rf-assessment-feedback" aria-label="Suggested actions">
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
            {filterLabels[name]} <span>{count(name)}</span>
          </button>
        ))}
      </div>
      <p className="rf-readiness-explainer">
        {mode === "rules"
          ? `${String(rules[filter].length)} rule groups. Entries keep their own status. Advice and dismissal keep the score.`
          : `${String(groups[filter].length)} checks · ${String(compact.length)} areas. Dismissal keeps the score.`}
      </p>
      {mode === "rules" ? (
        rules[filter].length ? (
          rules[filter].map((group, index) => {
            const visible = group.checks.filter((c) =>
              filter === "Completed"
                ? c.passed
                : !c.passed &&
                  (filter === "Deleted"
                    ? dismissed.includes(c.id)
                    : !dismissed.includes(c.id)),
            );
            const first = visible[0];
            if (!first) return null;
            const advice = group.checks.every((c) => c.scored === false);
            const actions = (check: ReadinessCheck) => (
              <div className="rf-readiness-issue-actions">
                {filter !== "Completed" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={disabled}
                    onClick={() => {
                      onTarget(check, true);
                    }}
                  >
                    Fix
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={disabled || !check.target}
                  onClick={() => {
                    onTarget(check, false);
                  }}
                >
                  View
                </Button>
                {filter !== "Completed" && onDismiss ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={disabled}
                    onClick={() => {
                      onDismiss(check, filter !== "Deleted");
                    }}
                  >
                    {filter === "Deleted" ? "Restore" : "Dismiss"}
                  </Button>
                ) : null}
              </div>
            );
            return (
              <details
                open={filter === "Pending" && index === 0}
                key={`${filter}:${group.id}`}
                className="rf-rule-card"
                data-check-status={
                  filter === "Completed" ? "passed" : "pending"
                }
              >
                <summary className="rf-rule-heading">
                  {filter === "Completed" ? (
                    <CircleCheck size={18} aria-hidden="true" />
                  ) : (
                    <TriangleAlert size={18} aria-hidden="true" />
                  )}
                  <h4>{group.title}</h4>
                  {advice ? (
                    <span className="rf-rule-advice">Advice</span>
                  ) : null}
                </summary>
                <div className="rf-rule-body">
                  {visible.length === 1 ? (
                    <>
                      {label && first.target ? (
                        <p className="rf-rule-target">{label(first)}</p>
                      ) : null}
                      <details className="rf-rule-reason">
                        <summary>Reason</summary>
                        <p>{first.reason}</p>
                      </details>
                      {actions(first)}
                    </>
                  ) : (
                    <details
                      className="rf-rule-instances"
                      open={index === 0 && filter === "Pending"}
                    >
                      <summary>
                        Review {visible.length} checks
                        {filter === "Pending" ? " needing attention" : ""}
                      </summary>
                      {visible.map((check) => (
                        <div key={check.id} className="rf-rule-instance">
                          <strong>
                            {label && check.target ? label(check) : check.title}
                          </strong>
                          {check.title !== group.title ? (
                            <small>{check.title}</small>
                          ) : null}
                          <details className="rf-rule-reason">
                            <summary>Reason</summary>
                            <p>{check.reason}</p>
                          </details>
                          {actions(check)}
                        </div>
                      ))}
                    </details>
                  )}
                </div>
              </details>
            );
          })
        ) : (
          <p role="status">{emptyLabels[filter]}</p>
        )
      ) : !compact.length ? (
        <p role="status">{emptyLabels[filter]}</p>
      ) : (
        compact.map((group, index) => (
          <details
            key={`${filter}:${group.id}`}
            className="rf-check-area"
            open={index === 0 && filter === "Pending"}
          >
            <summary>
              <span>{labels[group.id] ?? group.id}</span>
              <small>
                {group.checks.length}{" "}
                {group.checks.length === 1 ? "check" : "checks"}
              </small>
            </summary>
            <div className="rf-check-area-body">
              {group.checks.map((check) => (
                <article
                  key={check.id}
                  className="rf-readiness-issue"
                  data-check-status={check.passed ? "passed" : "pending"}
                >
                  <h4>{check.title}</h4>
                  {label && check.target ? (
                    <p className="rf-tool-hint">{label(check)}</p>
                  ) : null}
                  <details>
                    <summary>Reason</summary>
                    <p>{check.reason}</p>
                  </details>
                  <div className="rf-readiness-issue-actions">
                    {filter !== "Completed" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={disabled}
                        onClick={() => {
                          onTarget(check, true);
                        }}
                      >
                        Fix
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={disabled || !check.target}
                      onClick={() => {
                        onTarget(check, false);
                      }}
                    >
                      View
                    </Button>
                    {filter !== "Completed" && onDismiss ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={disabled}
                        onClick={() => {
                          onDismiss(check, filter !== "Deleted");
                        }}
                      >
                        {filter === "Deleted" ? "Restore" : "Dismiss"}
                      </Button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </details>
        ))
      )}
    </section>
  );
}
