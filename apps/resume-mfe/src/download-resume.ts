import { type createResumeApi } from "./resume-api";

/** Browser download uses only authenticated server bytes for a saved version. */
export async function downloadResumePdf(
  api: ReturnType<typeof createResumeApi>,
  id: string,
  version: number,
  title: string,
) {
  const blob = await api.download(id, version);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${title.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100) || "Resume"}-v${String(version)}.pdf`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
