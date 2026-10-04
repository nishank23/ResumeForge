import type { ParsedResumeContentDto } from "./contracts.js";

/**
 * Formats structured resume content into clean Markdown.
 */
export function formatResumeAsMarkdown(content: ParsedResumeContentDto): string {
  const parts: string[] = [];

  // Header
  const header = content.header;
  const name = header.fullName || [header.firstName, header.lastName].filter(Boolean).join(" ") || "Resume";
  parts.push(`# ${name}`);

  if (header.headline) {
    parts.push(`**${header.headline}**\n`);
  }

  const contactItems: string[] = [];
  if (header.email) contactItems.push(header.email);
  if (header.phone) contactItems.push(header.phone);
  const location = [header.city, header.state, header.country].filter(Boolean).join(", ");
  if (location) contactItems.push(location);
  if (header.links.length > 0) {
    for (const link of header.links) {
      contactItems.push(`[${link.label || link.url}](${link.url})`);
    }
  }

  if (contactItems.length > 0) {
    parts.push(contactItems.join(" | ") + "\n");
  }

  // Sections
  for (const section of content.sections) {
    if (section.hidden) continue;

    parts.push(`## ${section.label}\n`);

    if (section.kind === "summary" && section.summary) {
      parts.push(section.summary + "\n");
    } else if (section.kind === "experience") {
      for (const entry of (section.entries as unknown as Array<{
        title?: string;
        subtitle?: string;
        location?: string;
        startDate?: string;
        endDate?: string;
        isCurrent?: boolean;
        bullets?: Array<{ text: string; hidden?: boolean }>;
        hidden?: boolean;
      }>)) {
        if (entry.hidden) continue;
        const role = [entry.title, entry.subtitle].filter(Boolean).join(" — ");
        parts.push(`### ${role}`);
        const dateRange = [entry.startDate, entry.isCurrent ? "Present" : entry.endDate].filter(Boolean).join(" – ");
        const meta = [dateRange, entry.location].filter(Boolean).join(" | ");
        if (meta) parts.push(`*${meta}*`);
        if (entry.bullets && entry.bullets.length > 0) {
          for (const b of entry.bullets) {
            if (!b.hidden && b.text) parts.push(`- ${b.text}`);
          }
        }
        parts.push("");
      }
    } else if (section.kind === "education") {
      for (const entry of (section.entries as unknown as Array<{
        title?: string;
        subtitle?: string;
        fieldOfStudy?: string;
        startDate?: string;
        endDate?: string;
        grade?: string;
        hidden?: boolean;
      }>)) {
        if (entry.hidden) continue;
        const degree = [entry.subtitle, entry.fieldOfStudy].filter(Boolean).join(", ");
        const title = [entry.title, degree].filter(Boolean).join(" — ");
        parts.push(`### ${title}`);
        const dateRange = [entry.startDate, entry.endDate].filter(Boolean).join(" – ");
        const meta = [dateRange, entry.grade ? `GPA: ${entry.grade}` : ""].filter(Boolean).join(" | ");
        if (meta) parts.push(`*${meta}*`);
        parts.push("");
      }
    } else if (section.kind === "skills") {
      if (section.groups.length > 0) {
        for (const g of section.groups) {
          const items = g.items.filter((i) => !i.hidden).map((i) => i.text).join(", ");
          if (items) parts.push(`- **${g.label}**: ${items}`);
        }
      } else {
        const items = section.entries.map((e) => (typeof e === "string" ? e : (e as { name?: string }).name)).filter(Boolean).join(", ");
        if (items) parts.push(items);
      }
      parts.push("");
    } else if (section.kind === "projects") {
      for (const entry of (section.entries as unknown as Array<{
        title?: string;
        subtitle?: string;
        description?: string;
        technologies?: string;
        bullets?: Array<{ text: string; hidden?: boolean }>;
        hidden?: boolean;
      }>)) {
        if (entry.hidden) continue;
        parts.push(`### ${entry.title ?? "Project"}`);
        if (entry.technologies) parts.push(`*Technologies: ${entry.technologies}*`);
        if (entry.description) parts.push(entry.description);
        if (entry.bullets && entry.bullets.length > 0) {
          for (const b of entry.bullets) {
            if (!b.hidden && b.text) parts.push(`- ${b.text}`);
          }
        }
        parts.push("");
      }
    }
  }

  return parts.join("\n");
}

/**
 * Formats structured resume content into plain text.
 */
export function formatResumeAsText(content: ParsedResumeContentDto): string {
  const md = formatResumeAsMarkdown(content);
  return md
    .replace(/^#+ /gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1");
}

/**
 * Formats structured resume content into clean, printable HTML.
 */
export function formatResumeAsHtml(content: ParsedResumeContentDto): string {
  const md = formatResumeAsMarkdown(content);
  const escape = (str: string) =>
    str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const lines = md.split("\n");
  const htmlParts: string[] = [];

  htmlParts.push(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escape(content.title || "Resume")}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; color: #1a1a1a; max-width: 800px; margin: 40px auto; padding: 0 20px; }
    h1 { font-size: 28px; margin-bottom: 4px; }
    h2 { font-size: 18px; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-top: 24px; text-transform: uppercase; letter-spacing: 0.5px; }
    h3 { font-size: 15px; margin: 12px 0 2px 0; }
    p { margin: 6px 0; }
    ul { margin: 4px 0 12px 20px; padding: 0; }
    li { margin-bottom: 3px; }
    .contact { font-size: 14px; color: #555; margin-bottom: 16px; }
    .meta { font-size: 13px; color: #666; font-style: italic; margin-bottom: 6px; }
    @media print { body { margin: 0; padding: 0; } }
  </style>
</head>
<body>`);

  for (const line of lines) {
    if (line.startsWith("# ")) {
      htmlParts.push(`<h1>${escape(line.slice(2))}</h1>`);
    } else if (line.startsWith("## ")) {
      htmlParts.push(`<h2>${escape(line.slice(3))}</h2>`);
    } else if (line.startsWith("### ")) {
      htmlParts.push(`<h3>${escape(line.slice(4))}</h3>`);
    } else if (line.startsWith("- ")) {
      htmlParts.push(`<ul><li>${escape(line.slice(2))}</li></ul>`);
    } else if (line.startsWith("*") && line.endsWith("*")) {
      htmlParts.push(`<div class="meta">${escape(line.slice(1, -1))}</div>`);
    } else if (line.trim().length > 0) {
      htmlParts.push(`<p>${escape(line)}</p>`);
    }
  }

  htmlParts.push(`</body></html>`);
  return htmlParts.join("\n");
}
