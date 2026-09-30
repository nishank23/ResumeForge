import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, FileText, Sparkles } from "lucide-react";
import {
  AuroraBackdrop,
  Badge,
  Button,
  DocumentPageSurface,
  GlassCardSurface,
  ResumeIntentPrompt,
  ResumeSectionPrompt,
  type DocumentSectionBlock,
  type ResumeCreationMode,
  type ResumeSectionType,
  type ResumeSuggestionAction,
  type ShellFederationContext,
} from "@resume-forge/shared";

export interface ResumeRemoteRootProps {
  readonly context?: ShellFederationContext;
  readonly view?: "create" | "editor";
}

const INITIAL_SECTIONS: ReadonlyArray<
  DocumentSectionBlock & { readonly sectionType: ResumeSectionType }
> = [
  {
    sectionId: "sec-summary",
    sectionType: "summary",
    sectionLabel: "Professional Summary",
    itemId: "item-summary-01",
    itemLabel: "Executive Overview",
    content:
      "Backend engineer with 7 years of experience building distributed microservices, event-driven data pipelines, and resilient API gateways.",
  },
  {
    sectionId: "sec-exp-1",
    sectionType: "experience",
    sectionLabel: "Work Experience",
    itemId: "item-exp-01-bullet-1",
    itemLabel: "Staff Engineer · Synthetic Cloud Systems (2022–Present)",
    content:
      "Led migration of core billing ingestion pipeline to partitioned stream workers, reducing p99 latency from 420ms to 95ms across 45k req/sec.",
  },
  {
    sectionId: "sec-proj-1",
    sectionType: "projects",
    sectionLabel: "Projects",
    itemId: "item-proj-01",
    itemLabel: "SchemaGuard Open-Source Validator",
    content:
      "Created deterministic contract validator for TypeScript and JSONB schemas with zero runtime dependencies.",
  },
  {
    sectionId: "sec-skills",
    sectionType: "skills",
    sectionLabel: "Technical Skills",
    itemId: "item-skills-01",
    itemLabel: "Core Stack",
    content:
      "TypeScript, Node.js, Go, PostgreSQL, pgvector, Kafka, Redis, OpenTelemetry, Kubernetes.",
  },
];

const SYNTHETIC_REWRITES: Record<string, { text: string; reason: string }> = {
  "sec-summary": {
    text: "Staff-level Backend Engineer with 7 years of experience architecting high-throughput distributed microservices, partitioned event pipelines (45k req/sec), and low-latency API gateways.",
    reason:
      "Surfaces supported scale metrics (45k req/sec) from verified profile fact exp_fact_01 while keeping wording concise.",
  },
  "sec-exp-1": {
    text: "Architected partitioned stream-worker migration for the core billing pipeline, cutting p99 ingestion latency by 77% (420ms to 95ms) at 45,000 req/sec.",
    reason:
      "Front-loads the active verb and highlights the exact 420ms → 95ms latency reduction from your confirmed profile entry.",
  },
  "sec-proj-1": {
    text: "Engineered SchemaGuard, a zero-dependency TypeScript and JSONB boundary contract validator for distributed API services.",
    reason:
      "Clarifies architectural relevance without inventing unverified adoption metrics.",
  },
  "sec-skills": {
    text: "Languages & Runtime: TypeScript, Node.js, Go · Data & Vectors: PostgreSQL, pgvector, Redis, Kafka · Infrastructure: Kubernetes, OpenTelemetry.",
    reason:
      "Groups verified profile skills into ATS-scannable domain clusters.",
  },
};

export function ResumeRemoteRoot({
  context,
  view = "editor",
}: ResumeRemoteRootProps) {
  const [intentText, setIntentText] = useState("");
  const [creationMode, setCreationMode] =
    useState<ResumeCreationMode>("profile_copy");
  const [intentReady, setIntentReady] = useState(false);
  const [sections, setSections] = useState(INITIAL_SECTIONS);
  const [selectedId, setSelectedId] = useState("sec-summary");
  const [instruction, setInstruction] = useState("");
  const [action, setAction] =
    useState<ResumeSuggestionAction>("improve_wording");
  const [proposal, setProposal] = useState<{
    sectionId: string;
    original: string;
    text: string;
    reason: string;
  } | null>(null);
  const [notice, setNotice] = useState("");
  const [mobileView, setMobileView] = useState<"document" | "assistant">(
    "document",
  );
  const assistantHeadingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (
      mobileView === "assistant" &&
      window.matchMedia("(max-width: 760px)").matches
    ) {
      assistantHeadingRef.current?.focus();
    }
  }, [mobileView, selectedId]);
  const selected =
    sections.find((section) => section.sectionId === selectedId) ?? sections[0];
  if (!selected) return null;
  const prefix = `/w/${context?.activeWorkspace.id ?? "ws-personal-01"}`;
  const goBack = () => {
    context?.onNavigate?.(`${prefix}/resumes`);
  };
  const select = (section: DocumentSectionBlock) => {
    setSelectedId(section.sectionId);
    setProposal(null);
    setInstruction("");
    setNotice("");
    setMobileView("assistant");
  };
  const request = () => {
    const rewrite = SYNTHETIC_REWRITES[selected.sectionId];
    if (!rewrite) return;
    setProposal({
      sectionId: selected.sectionId,
      original: selected.content,
      text: rewrite.text,
      reason: rewrite.reason,
    });
    setNotice("");
  };
  const apply = () => {
    if (!proposal || proposal.sectionId !== selectedId) return;
    setSections((previous) =>
      previous.map((section) =>
        section.sectionId === proposal.sectionId
          ? { ...section, content: proposal.text }
          : section,
      ),
    );
    setProposal(null);
    setNotice(
      "Sample change applied to this section. It will reset when you leave this preview.",
    );
  };
  return (
    <div
      className="rf-page"
      data-remote-module="resume_mfe"
      data-react-version={React.version}
    >
      {context?.onNavigate ? (
        <button className="rf-back" onClick={goBack}>
          <ArrowLeft size={16} aria-hidden="true" />
          My resumes
        </button>
      ) : null}
      {view === "create" ? (
        <>
          <div className="rf-page-heading">
            <h1>Start with your experience.</h1>
            <p>Choose a starting point for your next resume.</p>
          </div>
          <section className="rf-create-panel">
            <AuroraBackdrop staticMode reducedMotion={context?.reducedMotion} />
            <div className="rf-create-content">
              <ResumeIntentPrompt
                value={intentText}
                onChange={setIntentText}
                mode={creationMode}
                onModeChange={(mode) => {
                  setCreationMode(mode);
                  setIntentReady(false);
                }}
                onSubmitIntent={() => {
                  setIntentReady(true);
                }}
              />
            </div>
          </section>
          {intentReady ? (
            <div className="rf-preview-confirmation" role="status">
              <FileText size={24} />
              <div>
                <h2>Your starting point is selected</h2>
                <p>
                  Draft creation and AI tailoring are not connected yet. You can
                  explore the sample editor now; your input will not be sent or
                  saved.
                </p>
                {context?.onNavigate ? (
                  <Button
                    onClick={() => {
                      context.onNavigate?.(`${prefix}/resumes/res-draft-01`);
                    }}
                  >
                    Open sample editor
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
          <div className="rf-create-notes">
            <div>
              <h3>Your profile stays yours</h3>
              <p>Resume changes will stay separate from your master profile.</p>
            </div>
            <div>
              <h3>You review every change</h3>
              <p>Suggestions are compared before you choose to apply them.</p>
            </div>
            <div>
              <h3>One clear starting layout</h3>
              <p>
                A simple, readable document that puts your experience first.
              </p>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="rf-page-heading rf-heading-row">
            <div>
              <h1>Backend engineer</h1>
              <p>Alex Rivera · Sample resume</p>
            </div>
            <Badge variant="outline">Session preview</Badge>
          </div>
          <p className="rf-editor-notice">
            <Sparkles size={16} aria-hidden="true" />
            Try a sample rewrite. No AI requests, saved versions, scores, or
            exports are connected yet.
          </p>
          <div className="rf-mobile-tabs" role="group" aria-label="Editor view">
            <button
              aria-pressed={mobileView === "document"}
              onClick={() => {
                setMobileView("document");
              }}
            >
              Resume preview
            </button>
            <button
              aria-pressed={mobileView === "assistant"}
              onClick={() => {
                setMobileView("assistant");
              }}
            >
              Section assistant
            </button>
          </div>
          <div className="rf-editor-grid">
            <div
              className={`rf-editor-document ${mobileView === "document" ? "is-visible" : ""}`}
            >
              <DocumentPageSurface
                candidateName="Alex Rivera"
                contactNotice="Sample content"
                versionNumber={1}
                pageCount={1}
                sections={sections}
                selectedSectionId={selectedId}
                onSelectSection={select}
              />
              <p className="rf-document-caption">
                Select a section to explore a focused rewrite.
              </p>
            </div>
            <aside
              className={`rf-editor-assistant ${mobileView === "assistant" ? "is-visible" : ""}`}
              aria-label="Section assistant"
            >
              <div className="rf-assistant-heading">
                <Sparkles size={18} />
                <h2 ref={assistantHeadingRef} tabIndex={-1}>
                  Section assistant
                </h2>
                <Badge variant="secondary">Sample</Badge>
              </div>
              <div
                className="rf-section-picker"
                role="group"
                aria-label="Choose a resume section"
              >
                {sections.map((section) => (
                  <button
                    key={section.sectionId}
                    aria-pressed={selectedId === section.sectionId}
                    onClick={() => {
                      select(section);
                    }}
                  >
                    {section.sectionLabel
                      .replace("Professional ", "")
                      .replace("Work ", "")
                      .replace("Technical ", "")}
                  </button>
                ))}
              </div>
              <ResumeSectionPrompt
                target={{
                  sectionId: selected.sectionId,
                  sectionType: selected.sectionType,
                  sectionLabel: selected.sectionLabel,
                  itemId: selected.itemId,
                  itemLabel: selected.itemLabel,
                  currentText: selected.content,
                }}
                selectedAction={action}
                onSelectAction={(next) => {
                  setAction(next);
                  setProposal(null);
                }}
                instruction={instruction}
                onInstructionChange={setInstruction}
                hasJobDescription={false}
                onSubmitRequest={request}
              />
              {proposal ? (
                <GlassCardSurface glowOnHover={false} className="rf-review">
                  <h3>Review sample rewrite</h3>
                  <p className="rf-review-note">
                    A fixed example, independent of your instruction.
                  </p>
                  <div className="rf-comparison">
                    <section>
                      <h4>Original</h4>
                      <p>{proposal.original}</p>
                    </section>
                    <section>
                      <h4>Suggested</h4>
                      <p>{proposal.text}</p>
                    </section>
                  </div>
                  <details>
                    <summary>Why this wording?</summary>
                    <p>{proposal.reason}</p>
                  </details>
                  <div className="rf-review-actions">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setProposal(null);
                      }}
                    >
                      Discard
                    </Button>
                    <Button onClick={apply}>Apply sample change</Button>
                  </div>
                </GlassCardSurface>
              ) : (
                <div className="rf-assistant-hint">
                  <FileText size={19} />
                  <p>
                    Choose a section and request a sample suggestion. Your
                    original text stays unchanged until you apply it.
                  </p>
                </div>
              )}
              {notice ? (
                <p className="rf-inline-success" role="status">
                  {notice}
                </p>
              ) : null}
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
export default ResumeRemoteRoot;
