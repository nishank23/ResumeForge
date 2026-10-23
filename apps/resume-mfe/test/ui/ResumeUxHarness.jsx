/* Synthetic browser fixture. This file is never imported by an application entrypoint. */
import { useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "@resume-forge/shared/styles.css";
import { summaryFromText } from "@resume-forge/shared";
import {
  applyTailoringPreview,
  tailoringRunSchema,
} from "@resume-forge/shared-types";
import { ManualResumeEditor } from "../../src/ManualResumeEditor";
import { TailoringDialog } from "../../src/TailoringDialog";
import { ResumeImportDialog } from "../../src/ResumeImportDialog";
import { ResumeLibrary } from "../../src/ResumeLibrary";
import {
  blankResume,
  toResumeContent,
  createResumeApi,
} from "../../src/resume-api";
import { emptyEntry, richTextPlain } from "../../src/editor-draft";
import "../../src/resume-library.css";
const ids = {
  workspace: "11111111-1111-4111-8111-111111111111",
  source: "22222222-2222-4222-8222-222222222222",
  run: "33333333-3333-4333-8333-333333333333",
  copy: "44444444-4444-4444-8444-444444444444",
};
const params = new URLSearchParams(location.search),
  mode = params.get("view") ?? "editor";
const fixture = blankResume("Morgan Example");
fixture.synthetic = true;
fixture.title = params.has("long-title")
  ? "Backend engineering resume · tailored · tailored · tailored"
  : "Backend resume";
const summary = fixture.sections.find((s) => s.kind === "summary");
summary.summary = summaryFromText(
  "Backend developer building Python APIs and SQL data services.",
);
const work = fixture.sections.find((s) => s.kind === "experience"),
  entry = emptyEntry("backend-role");
entry.title = "Backend Developer";
entry.subtitle = "Demo Systems";
entry.description = summaryFromText("Built Python APIs for invoice review.");
entry.dates = {
  startMonth: "1",
  startYear: "2022",
  endMonth: "12",
  endYear: "2024",
  current: false,
  yearOnly: false,
};
entry.bullets = [
  {
    id: "api-bullet",
    text: "Maintained PostgreSQL queries and wrote automated tests with pytest.",
    hidden: false,
  },
];
work.entries.push(entry);
const education = fixture.sections.find((s) => s.kind === "education"),
  degree = emptyEntry("degree");
degree.title = "Example University";
degree.subtitle = "BSc";
degree.fieldOfStudy = "Computer Science";
degree.dates = { ...degree.dates, endYear: "2021", yearOnly: true };
education.entries.push(degree);
const project = fixture.sections.find((s) => s.kind === "projects"),
  projectEntry = emptyEntry("invoice-tool");
projectEntry.title = "Invoice Review Tool";
projectEntry.description = summaryFromText(
  "Built a Python invoice review tool with PostgreSQL.",
);
project.entries.push(projectEntry);
fixture.sections
  .find((s) => s.kind === "skills")
  .groups.push({
    id: "tools",
    label: "General",
    items: ["Python", "SQL", "PostgreSQL", "pytest", "Git"].map((text, i) => ({
      id: `skill-${i}`,
      text,
      hidden: false,
    })),
  });
const jd =
  "Backend Engineer: build Python APIs and PostgreSQL data services. Investigate failed requests and write automated tests with pytest. Kubernetes is preferred.";
const qa = {
  events: [],
  saveFails: false,
  pdfFails: false,
  preflightStale: false,
  providerFails: false,
  atsPreferredOnly: false,
  atsFails: false,
  atsUnauthorized: false,
  delayAts: false,
  resolveAts: null,
  delaySave: false,
  resolveSave: null,
  finishQueue: false,
  closed: false,
  version: 1,
  latest: structuredClone(fixture),
  request: async (_p, _o) => new Response(),
};
window.__resumeUx = qa;
const event = (name, data = {}) => qa.events.push({ name, ...data });
const context = {
  activeWorkspace: { id: ids.workspace, type: "individual", name: "Personal" },
  workspaces: [],
  theme: params.get("theme") === "light" ? "light" : "dark",
  reducedMotion: true,
  onNavigate: (path) => event("navigate", { path }),
};
document.documentElement.dataset.theme = context.theme;
document.documentElement.classList.toggle("dark", context.theme === "dark");
function row(doc = fixture, id = ids.source, version = 1) {
  return {
    id,
    workspaceId: ids.workspace,
    title: doc.title,
    currentVersion: version,
    status: "draft",
    updatedAt: new Date().toISOString(),
    content: toResumeContent(doc),
  };
}
qa.request = async (path, options = {}) => {
  const method = options.method ?? "GET";
  event("request", { path, method });
  let data;
  if (path.endsWith("/ats-assessment")) {
    if (qa.atsUnauthorized)
      return new Response(
        JSON.stringify({ error: { code: "unauthenticated" } }),
        { status: 401 },
      );
    if (qa.atsFails)
      return new Response(
        JSON.stringify({
          error: {
            code: "provider_unavailable",
            message: "PRIVATE PROVIDER DEBUG",
          },
        }),
        { status: 503 },
      );
    if (method === "POST") {
      const body = JSON.parse(String(options.body));
      event("atsRun", body);
      if (qa.delayAts)
        await new Promise((resolve) => {
          qa.resolveAts = resolve;
        });
      qa.atsEvaluation = {
        id: ids.run,
        resumeId: ids.source,
        versionId: ids.copy,
        resumeVersion: qa.version,
        inputHash: "a".repeat(64),
        jdHash: "b".repeat(64),
        evaluatedAt: new Date().toISOString(),
        assessment: {
          rubricVersion: "ats-evidence-v1",
          model: "synthetic-gemini",
          score: 50,
          coverage: {
            required: { supported: 1, total: 2 },
            preferred: { supported: 0, total: 1 },
          },
          requirements: [
            {
              id: "python",
              requirement: "Build Python APIs",
              jdQuote: "build Python APIs",
              importance: "required",
              status: "supported",
              evidence: [
                {
                  sourceId: "experience:backend-role",
                  quote: "Built Python APIs for invoice review.",
                },
              ],
            },
            {
              id: "operations",
              requirement: "Investigate failed requests",
              jdQuote: "Investigate failed requests",
              importance: "required",
              status: "uncertain",
              evidence: [],
            },
            {
              id: "kubernetes",
              requirement: "Kubernetes",
              jdQuote: "Kubernetes is preferred",
              importance: "preferred",
              status: "missing",
              evidence: [],
            },
          ],
          warnings: ["Synthetic evidence fixture only."],
        },
      };
    }
    if (qa.atsPreferredOnly && qa.atsEvaluation) {
      const assessment = qa.atsEvaluation.assessment;
      assessment.requirements = assessment.requirements.filter(
        (item) => item.importance === "preferred",
      );
      assessment.coverage.required = { supported: 0, total: 0 };
      assessment.score = 0;
    }
    data = {
      currentVersion: qa.version,
      evaluation:
        qa.atsEvaluation?.resumeVersion === qa.version
          ? qa.atsEvaluation
          : null,
    };
  } else if (path === "/api/v1/resume" && method === "GET") data = [row()];
  else if (path === "/api/v1/resume" && method === "POST") {
    const body = JSON.parse(String(options.body));
    event("create", { content: body.content });
    data = {
      ...row(),
      content: body.content,
      title: body.content.editorDocument?.title ?? "Untitled resume",
    };
  } else
    return new Response(
      JSON.stringify({
        error: {
          code: "not_found",
          message: "Fixture endpoint not configured",
        },
      }),
      { status: 404 },
    );
  return new Response(JSON.stringify({ data }), {
    headers: { "Content-Type": "application/json" },
  });
};
function Harness() {
  const [doc, setDoc] = useState(structuredClone(fixture)),
    [version, setVersion] = useState(1),
    [closed, setClosed] = useState(false);
  const current = useRef(doc);
  current.current = doc;
  const storedRun = useRef(null);
  const makeRun = (status = "ready") =>
    tailoringRunSchema.parse({
      id: ids.run,
      sourceVersion: params.get("case") === "stale" ? version + 1 : version,
      model: "gemini-3.8-flash",
      promptVersion: "tailor-v3",
      additionalFacts: [],
      quality: null,
      warnings: [],
      status,
      jobTitle: "Backend Engineer",
      jdText: jd,
      requirements: [
        {
          name: "Kubernetes",
          category: "tool",
          required: false,
          evidence: "Kubernetes preferred",
        },
      ],
      responsibilities: [],
      createdAt: new Date().toISOString(),
      expiresAt: new Date(
        Date.now() + (params.get("case") === "expired" ? -60000 : 3600000),
      ).toISOString(),
      batchesDone: status === "ready" ? 4 : 0,
      batchesTotal: 4,
      before: {
        score: 83,
        matched: ["Python"],
        missing: ["Kubernetes"],
        statedYears: null,
        datedYears: 3,
        experienceLevel: "not stated",
      },
      after: {
        score: 83,
        matched: ["Python"],
        missing: ["Kubernetes"],
        statedYears: null,
        datedYears: 3,
        experienceLevel: "not stated",
      },
      changes:
        params.get("case") === "empty"
          ? []
          : [
              {
                id: "summary-change",
                kind: "text",
                target: { type: "section", sectionId: summary.id },
                field: "summary",
                label: "Summary",
                original: richTextPlain(
                  current.current.sections.find((s) => s.kind === "summary")
                    .summary,
                ),
                proposed:
                  "Backend developer building Python APIs and PostgreSQL data services, with automated testing experience using pytest.",
                facts: ["professional-summary"],
                evidence: [
                  "Built Python APIs for invoice review.",
                  "Wrote automated tests with pytest.",
                ],
              },
              ...(params.get("case") === "multiple"
                ? [
                    {
                      id: "role-change",
                      kind: "text",
                      target: {
                        type: "entry",
                        sectionId: work.id,
                        itemId: entry.id,
                      },
                      field: "description",
                      label: "Backend Developer",
                      original: richTextPlain(entry.description),
                      proposed:
                        "Built Python APIs for invoice review, maintained PostgreSQL queries and wrote automated tests with pytest.",
                      facts: ["work-description"],
                      evidence: [
                        "Built Python APIs for invoice review.",
                        "Maintained PostgreSQL queries and wrote automated tests with pytest.",
                      ],
                    },
                  ]
                : []),
            ],
      copyId: status === "saved" ? ids.copy : null,
      error: null,
    });
  const services = useMemo(() => {
    if (
      !storedRun.current &&
      [
        "ready",
        "empty",
        "stale",
        "expired",
        "saved",
        "queued",
        "multiple",
      ].includes(params.get("case") ?? "")
    )
      storedRun.current = makeRun(
        params.get("case") === "saved"
          ? "saved"
          : params.get("case") === "queued"
            ? "queued"
            : "ready",
      );
    return {
      load: async () => {
        if (qa.finishQueue && storedRun.current?.status === "queued")
          storedRun.current = makeRun();
        return {
          currentVersion: version,
          available: true,
          run: storedRun.current,
        };
      },
      analyze: async (text) => {
        event("analyze", { version, text });
        return {
          currentVersion: qa.preflightStale ? version + 1 : version,
          evaluation: {
            resumeVersion: version,
            keywords: [
              { term: "Python", matched: true },
              { term: "pytest", matched: true },
            ],
          },
        };
      },
      start: async (_id, text, facts) => {
        event("start", { id: _id, version, text, facts });
        if (qa.providerFails)
          throw new Error("Provider unavailable. Retry later.");
        storedRun.current = { ...makeRun(), additionalFacts: facts };
        return {
          currentVersion: version,
          available: true,
          run: storedRun.current,
        };
      },
      cancel: async () => {
        event("cancel");
        storedRun.current = { ...makeRun("cancelled") };
        return {
          currentVersion: version,
          available: true,
          run: storedRun.current,
        };
      },
      apply: async (_id, selected, title) => {
        event("apply", { version, selected, title });
        const next = applyTailoringPreview(
          current.current,
          storedRun.current.changes,
          selected,
        );
        next.title = title;
        return row(next, ids.copy, 1);
      },
      downloadCopy: async (id, savedVersion, title) => {
        event("copyPdf", { id, version: savedVersion, title });
        if (qa.pdfFails) throw new Error("Synthetic export unavailable.");
      },
      openCopy: (id) => event("openCopy", { id }),
    };
  }, [version]);
  const atsAssessment = useMemo(() => {
    const api = createResumeApi(qa.request, ids.workspace);
    return {
      load: (signal) => api.atsAssessment(ids.source, signal),
      run: (text) => api.runAtsAssessment(ids.source, version, text),
    };
  }, [version]);
  const save = async (next) => {
    event("saveStart", { version, title: next.title });
    if (qa.delaySave)
      await new Promise((resolve) => {
        qa.resolveSave = resolve;
      });
    if (qa.saveFails)
      throw Object.assign(
        new Error("A newer version was saved elsewhere. Reload before saving."),
        { code: "revision_conflict" },
      );
    qa.latest = structuredClone(next);
    qa.version = version + 1;
    setDoc(qa.latest);
    setVersion(qa.version);
    event("saveComplete", { version: qa.version });
    return qa.version;
  };
  const close = () => {
    qa.closed = true;
    setClosed(true);
    event("close");
  };
  if (closed) return <p role="status">Fixture closed</p>;
  if (mode === "tailoring")
    return (
      <TailoringDialog
        base={doc}
        savedVersion={version}
        initialJd={jd}
        services={services}
        reducedMotion
        onClose={close}
      />
    );
  if (mode === "import")
    return (
      <ResumeImportDialog
        context={context}
        api={{
          parse: async () => {
            event("parse");
            return {
              draft: structuredClone(fixture),
              text: "Synthetic import source",
            };
          },
          create: async (_id, next) => {
            event("createImport");
            return row(next);
          },
        }}
        onClose={close}
      />
    );
  if (mode === "library") return <ResumeLibrary context={context} />;
  return (
    <ManualResumeEditor
      context={context}
      initialDraft={doc}
      savedVersion={version}
      atsAssessment={atsAssessment}
      jdMatch={{ tailoring: services }}
      onSave={save}
      onDownload={async (savedVersion, title) => {
        event("pdf", { version: savedVersion, title });
        if (qa.pdfFails) throw new Error("Synthetic export unavailable.");
      }}
    />
  );
}
createRoot(document.getElementById("root")).render(<Harness />);
