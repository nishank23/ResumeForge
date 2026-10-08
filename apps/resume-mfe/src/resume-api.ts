import { editorDocumentSchema } from "@resume-forge/shared-types";
import { summaryFromText } from "@resume-forge/shared";
import { emptySection, emptyEntry, type ResumeDraft } from "./editor-draft";

export type ApiRequest = (
  path: string,
  options?: RequestInit,
) => Promise<Response>;
export interface SavedResume {
  id: string;
  workspaceId: string;
  title: string;
  currentVersion: number;
  status: string;
  updatedAt: string;
  content: Record<string, unknown>;
}
export type ResumeRow = Omit<SavedResume, "content">;
export class ResumeApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const str = (v: unknown) => (typeof v === "string" ? v : "");
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const list = (v: unknown) => (Array.isArray(v) ? v.map(record) : []);
function row(value: unknown, workspaceId: string): ResumeRow {
  const v = record(value);
  if (
    !uuid.test(str(v.id)) ||
    v.workspaceId !== workspaceId ||
    !Number.isInteger(v.currentVersion) ||
    Number(v.currentVersion) < 1 ||
    !str(v.title) ||
    !Number.isFinite(Date.parse(str(v.updatedAt)))
  )
    throw new ResumeApiError(
      "invalid_response",
      "Resume data could not be read.",
    );
  return {
    id: str(v.id),
    workspaceId,
    title: str(v.title),
    currentVersion: Number(v.currentVersion),
    status: str(v.status),
    updatedAt: str(v.updatedAt),
  };
}
export function blankResume(name = ""): ResumeDraft {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return {
    synthetic: false,
    title: "Untitled resume",
    header: {
      firstName: words.shift() ?? "",
      lastName: words.join(" "),
      headline: "",
      city: "",
      state: "",
      country: "",
    },
    sampleContact: { email: "", phone: "" },
    sections: ["summary", "experience", "education", "projects", "skills"].map(
      (kind, i) =>
        emptySection(
          kind as
            "summary" | "experience" | "education" | "projects" | "skills",
          `section-${String(i)}`,
        ),
    ),
  };
}
function richText(v: unknown): string {
  const node = record(v);
  return (
    str(node.text) ||
    (Array.isArray(node.content)
      ? node.content
          .map(richText)
          .join(node.type === "doc" || node.type === "bulletList" ? "\n" : "")
      : "")
  );
}
export function toResumeContent(draft: ResumeDraft): Record<string, unknown> {
  const editorDraft = editorDocumentSchema.parse(draft);
  return {
    title: draft.title,
    header: {
      ...draft.header,
      fullName: [draft.header.firstName, draft.header.lastName]
        .filter(Boolean)
        .join(" "),
      email: draft.sampleContact.email,
      phone: draft.sampleContact.phone,
      links: draft.header.links ?? [],
    },
    sampleContact: draft.sampleContact,
    sections: draft.sections.map((s) => ({
      id: s.id,
      kind: s.kind,
      label: s.label,
      hidden: s.hidden,
      summary: richText(s.summary),
      entries: s.entries.map((e) => ({
        ...e,
        description: richText(e.description),
      })),
      groups: s.groups,
    })),
    editorDraft,
  };
}
// Legacy parsed content is adapted once; the full editor document then persists
// rich text, precise dates, stable IDs, languages, visibility and appearance.
export function fromResumeContent(value: unknown): ResumeDraft {
  const v = record(value);
  if (v.editorDraft) return editorDocumentSchema.parse(v.editorDraft);
  const draft = blankResume();
  const header = record(v.header),
    contact = record(v.sampleContact);
  draft.title = str(v.title) || "Untitled resume";
  for (const k of [
    "firstName",
    "lastName",
    "headline",
    "city",
    "state",
    "country",
  ] as const)
    draft.header[k] = str(header[k]);
  draft.header.links = list(header.links)
    .filter((l) => /^https?:\/\//i.test(str(l.url)))
    .map((l) => ({
      id: str(l.id) || crypto.randomUUID(),
      label: str(l.label),
      url: str(l.url),
    }));
  draft.sampleContact = {
    email: str(contact.email) || str(header.email),
    phone: str(contact.phone) || str(header.phone),
  };
  draft.sections = list(v.sections).map((s) => {
    const kind = s.kind === "certifications" ? "projects" : s.kind;
    if (
      ![
        "summary",
        "experience",
        "education",
        "projects",
        "skills",
        "languages",
      ].includes(str(kind))
    )
      throw new ResumeApiError(
        "invalid_response",
        "This resume has an unsupported section.",
      );
    const section = emptySection(
      kind as (typeof draft.sections)[number]["kind"],
      str(s.id) || crypto.randomUUID(),
    );
    section.label = str(s.label);
    section.hidden = s.hidden === true;
    section.summary = summaryFromText(str(s.summary));
    section.entries = list(s.entries).map((e) => {
      const entry = emptyEntry(str(e.id) || crypto.randomUUID());
      for (const k of [
        "title",
        "subtitle",
        "location",
        "employmentType",
        "locationType",
        "fieldOfStudy",
        "grade",
        "technologies",
      ] as const)
        entry[k] = str(e[k]);
      entry.hidden = e.hidden === true;
      entry.description = summaryFromText(str(e.description));
      entry.bullets = list(e.bullets).map((b) => ({
        id: str(b.id) || crypto.randomUUID(),
        text: str(b.text),
        hidden: b.hidden === true,
      }));
      entry.links = list(e.links)
        .filter((l) => !str(l.url) || /^https?:\/\//i.test(str(l.url)))
        .map((l) => ({
          id: str(l.id) || crypto.randomUUID(),
          label: str(l.label),
          url: str(l.url),
        }));
      for (const [key, date] of [
        ["start", e.startDate],
        ["end", e.endDate],
      ] as const) {
        const parts = str(date).match(/^(\d{4})(?:-(\d{1,2}))?$/);
        if (parts) {
          entry.dates[key === "start" ? "startYear" : "endYear"] =
            parts[1] ?? "";
          entry.dates[key === "start" ? "startMonth" : "endMonth"] = parts[2]
            ? String(Number(parts[2]))
            : "";
        }
      }
      entry.dates.current =
        e.isCurrent === true || /present|current/i.test(str(e.endDate));
      entry.dates.yearOnly = !entry.dates.startMonth && !entry.dates.endMonth;
      return entry;
    });
    section.groups = list(s.groups).map((g) => ({
      id: str(g.id) || crypto.randomUUID(),
      label: str(g.label),
      items: list(g.items).map((i) => ({
        id: str(i.id) || crypto.randomUUID(),
        text: str(i.text),
        hidden: i.hidden === true,
      })),
    }));
    if (kind === "skills") {
      const spoken = section.groups.filter((g) =>
        /^languages$/i.test(g.label.trim()),
      );
      section.languages = spoken.flatMap((g) =>
        g.items.map((item) => ({ ...item, proficiency: "" })),
      );
      section.groups = section.groups.filter((g) => !spoken.includes(g));
    }
    if (kind === "languages") {
      section.languages = section.entries.flatMap((e) =>
        e.bullets.length
          ? e.bullets.map((b) => ({
              ...b,
              hidden: b.hidden || e.hidden,
              proficiency: "",
            }))
          : e.title && e.title !== section.label
            ? [{ id: e.id, text: e.title, hidden: e.hidden, proficiency: "" }]
            : [],
      );
      section.entries = [];
    }
    return section;
  });
  return editorDocumentSchema.parse(draft);
}
export function createResumeApi(request: ApiRequest, workspaceId: string) {
  async function call(
    path: string,
    method = "GET",
    body?: unknown,
    signal?: AbortSignal,
  ) {
    let response: Response;
    try {
      response = await request(path, {
        method,
        headers: {
          "X-Workspace-Id": workspaceId,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal,
      });
    } catch {
      throw new ResumeApiError(
        "unavailable",
        "Could not reach your resumes. Keep your edits and retry.",
      );
    }
    const envelope = record(await response.json().catch(() => null));
    if (!response.ok) {
      const code = str(record(envelope.error).code);
      throw new ResumeApiError(
        code,
        code === "revision_conflict"
          ? "A newer version exists. Your edits are kept; reopen the saved resume before saving again."
          : code === "invalid_input" || code === "unsupported_media_type"
            ? path.endsWith("/parse")
              ? "Could not read this file. Use a text-based PDF, DOCX, TXT or Markdown file."
              : "Could not save this document. Check field lengths, links and dates; your edits are kept."
            : code === "file_too_large"
              ? path.endsWith("/parse")
                ? "File exceeds the upload limit."
                : "Document exceeds the save limit. Shorten its content; your edits are kept."
              : code === "not_found"
                ? "This resume is no longer available."
                : "Could not load or save your resume. Retry when the service is available.",
      );
    }
    return envelope.data;
  }
  function detail(v: unknown): SavedResume {
    const data = record(v);
    const content = record(data.content);
    fromResumeContent(content);
    return { ...row(data, workspaceId), content };
  }
  function savedTarget(id: string, version: number) {
    if (
      !uuid.test(id) ||
      !Number.isSafeInteger(version) ||
      version < 1 ||
      version > 999999999
    )
      throw new ResumeApiError(
        "invalid_input",
        "Choose a saved resume version.",
      );
  }
  return {
    list: async (signal?: AbortSignal, cursor?: string) => {
      const data = await call(
        cursor ? `/api/v1/resume?cursor=${cursor}` : "/api/v1/resume",
        "GET",
        undefined,
        signal,
      );
      if (!Array.isArray(data))
        throw new ResumeApiError(
          "invalid_response",
          "Resume list could not be read.",
        );
      return data.map((v) => row(v, workspaceId));
    },
    load: async (id: string, signal?: AbortSignal) => {
      if (!uuid.test(id))
        throw new ResumeApiError(
          "not_found",
          "Open a saved resume from your library.",
        );
      return detail(
        await call(`/api/v1/resume/${id}`, "GET", undefined, signal),
      );
    },
    create: async (id: string, draft: ResumeDraft, sourceText?: string) =>
      detail(
        await call("/api/v1/resume", "POST", {
          id,
          content: {
            ...toResumeContent(draft),
            ...(sourceText ? { rawText: sourceText } : {}),
          },
        }),
      ),
    save: async (
      id: string,
      expectedVersion: number,
      draft: ResumeDraft,
      sourceText?: string,
    ) =>
      detail(
        await call(`/api/v1/resume/${id}`, "PUT", {
          expectedVersion,
          content: {
            ...toResumeContent(draft),
            ...(sourceText ? { rawText: sourceText } : {}),
          },
        }),
      ),
    remove: async (id: string, version: number) => {
      savedTarget(id, version);
      const result = record(
        await call(`/api/v1/resume/${id}`, "DELETE", {
          expectedVersion: version,
        }),
      );
      if (result.deleted !== true || result.id !== id)
        throw new ResumeApiError(
          "invalid_response",
          "Deletion could not be confirmed. Refresh your library.",
        );
    },
    restore: async (id: string, version: number) => {
      savedTarget(id, version);
      return detail(
        await call(`/api/v1/resume/${id}/restore`, "POST", {
          expectedVersion: version,
        }),
      );
    },
    download: async (id: string, version: number) => {
      savedTarget(id, version);
      let response: Response;
      try {
        response = await request(
          `/api/v1/resume/${id}/pdf?version=${String(version)}`,
          { headers: { "X-Workspace-Id": workspaceId } },
        );
      } catch {
        throw new ResumeApiError(
          "unavailable",
          "Could not download PDF. Retry when the service is available.",
        );
      }
      if (!response.ok) {
        const error = record(
          record(await response.json().catch(() => null)).error,
        );
        const code = str(error.code);
        throw new ResumeApiError(
          code,
          code === "revision_conflict"
            ? "A newer saved version exists. Refresh your library or reopen this resume before downloading."
            : code === "not_found"
              ? "This resume is no longer available."
              : code === "invalid_input"
                ? "PDF could not render this saved resume. Check its characters, then save again."
                : "Could not prepare PDF. Your saved resume is unchanged; retry.",
        );
      }
      if (
        response.headers.get("Content-Type")?.split(";")[0] !==
          "application/pdf" ||
        response.headers.get("X-Resume-Version") !== String(version)
      )
        throw new ResumeApiError(
          "invalid_response",
          "The downloaded file did not match this saved version.",
        );
      const blob = await response.blob();
      if (
        !blob.size ||
        blob.size > 15 * 1024 * 1024 ||
        (await blob.slice(0, 5).text()) !== "%PDF-"
      )
        throw new ResumeApiError(
          "invalid_response",
          "The downloaded PDF could not be read. Retry.",
        );
      return blob;
    },
    parse: async (file: File) => {
      const extensions: Record<string, string> = {
        pdf: "application/pdf",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        txt: "text/plain",
        md: "text/markdown",
      };
      const mimeType =
        extensions[file.name.split(".").at(-1)?.toLowerCase() ?? ""];
      if (!mimeType)
        throw new ResumeApiError(
          "unsupported_media_type",
          "Choose a PDF, DOCX, TXT or Markdown file.",
        );
      if (!file.size || file.size > 10 * 1024 * 1024)
        throw new ResumeApiError(
          "file_too_large",
          "Choose a non-empty file up to 10 MB.",
        );
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192)
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      const data = record(
        await call("/api/v1/resume/parse", "POST", {
          fileName: file.name,
          mimeType,
          fileBase64: btoa(binary),
        }),
      );
      return { draft: fromResumeContent(data), text: str(data.rawText) };
    },
  };
}
