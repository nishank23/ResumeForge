import { useEffect, useMemo, useRef, useState } from "react";
import { FilePlus2, FileText, Upload, Download, Trash2 } from "lucide-react";
import {
  Button,
  GlassCardSurface,
  AsciiSpotlight,
  StudioPrompt,
  DocumentStatus,
  RequestFeedback,
  StudioLoading,
  ConfirmDeleteDialog,
  useSession,
  type ShellFederationContext,
} from "@resume-forge/shared";
import { blankResume, createResumeApi, type ResumeRow } from "./resume-api";
import { ResumeImportDialog } from "./ResumeImportDialog";
import { downloadResumePdf } from "./download-resume";
import "./resume-library.css";

export function ResumeLibrary({
  context,
  initialUploadOpen = false,
}: {
  context: ShellFederationContext;
  initialUploadOpen?: boolean;
}) {
  const { requestApi, state } = useSession();
  const api = useMemo(
    () => createResumeApi(requestApi, context.activeWorkspace.id),
    [requestApi, context.activeWorkspace.id],
  );
  const [uploadOpen, setUploadOpen] = useState(initialUploadOpen);
  const [rows, setRows] = useState<ResumeRow[]>([]),
    [query, setQuery] = useState("");
  const [sort, setSort] = useState("updated"),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [creating, setCreating] = useState(false),
    [retry, setRetry] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<ResumeRow | null>(null);
  const [deletedRow, setDeletedRow] = useState<ResumeRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [notice, setNotice] = useState("");
  const listHeading = useRef<HTMLHeadingElement>(null);
  const createId = useRef(crypto.randomUUID()),
    busy = useRef(false);
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError("");
    api
      .list(abort.signal)
      .then((data) => {
        if (!abort.signal.aborted) {
          setRows(data);
          setMore(data.length === 50);
        }
      })
      .catch((e: unknown) => {
        if (!abort.signal.aborted)
          setError(e instanceof Error ? e.message : "Could not load resumes.");
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => {
      abort.abort();
    };
  }, [api, retry]);
  const prefix = `/w/${context.activeWorkspace.id}/resumes`;
  const create = async () => {
    if (busy.current) return;
    busy.current = true;
    setCreating(true);
    setError("");
    try {
      const saved = await api.create(
        createId.current,
        blankResume(
          state.status === "authenticated" ? (state.identity.name ?? "") : "",
        ),
      );
      context.onNavigate?.(`${prefix}/${saved.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create resume.");
    } finally {
      busy.current = false;
      setCreating(false);
    }
  };
  const loadMore = async () => {
    if (busy.current || !rows.length) return;
    busy.current = true;
    setLoadingMore(true);
    setError("");
    try {
      const page = await api.list(undefined, rows.at(-1)?.id);
      setRows((current) => [
        ...current,
        ...page.filter((r) => !current.some((old) => old.id === r.id)),
      ]);
      setMore(page.length === 50);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load more resumes.");
    } finally {
      busy.current = false;
      setLoadingMore(false);
    }
  };
  const remove = async () => {
    if (!deleteTarget || busy.current) return;
    busy.current = true;
    setDeleting(true);
    setDeleteError("");
    const target = deleteTarget;
    try {
      await api.remove(target.id, target.currentVersion);
      setRows((current) => current.filter((row) => row.id !== target.id));
      setDeletedRow(target);
      setDeleteTarget(null);
      setNotice(`Deleted “${target.title}” from your resumes.`);
      requestAnimationFrame(() => {
        listHeading.current?.focus();
      });
    } catch (e) {
      setDeleteError(
        e instanceof Error ? e.message : "Could not delete resume. Retry.",
      );
    } finally {
      busy.current = false;
      setDeleting(false);
    }
  };
  const restore = async () => {
    if (!deletedRow || busy.current) return;
    busy.current = true;
    setRestoring(true);
    setError("");
    try {
      const restored = await api.restore(
        deletedRow.id,
        deletedRow.currentVersion,
      );
      setRows((current) => [
        restored,
        ...current.filter((row) => row.id !== restored.id),
      ]);
      setDeletedRow(null);
      setNotice(`Restored “${restored.title}”.`);
      requestAnimationFrame(() => {
        listHeading.current?.focus();
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not restore resume. Retry.",
      );
    } finally {
      busy.current = false;
      setRestoring(false);
    }
  };
  const download = async (row: ResumeRow) => {
    if (busy.current) return;
    busy.current = true;
    setDownloading(row.id);
    setError("");
    try {
      await downloadResumePdf(api, row.id, row.currentVersion, row.title);
      setNotice(
        `PDF download started for “${row.title}”, saved version ${String(row.currentVersion)}.`,
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not download PDF. Retry.",
      );
    } finally {
      busy.current = false;
      setDownloading(null);
    }
  };
  const shown = rows
    .filter((r) =>
      r.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
    )
    .sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title) || a.id.localeCompare(b.id)
        : Date.parse(b.updatedAt) - Date.parse(a.updatedAt) ||
          a.id.localeCompare(b.id),
    );
  return (
    <div className="rf-page rf-resume-library">
      <div className="rf-page-heading">
        <h1>My resumes</h1>
        <p>Keep your work, and every saved version, within reach.</p>
      </div>
      <div className="rf-library-desk">
        <GlassCardSurface
          glowOnHover={false}
          className="rf-library-start"
          aria-labelledby="rf-library-start-title"
        >
          <AsciiSpotlight
            theme={context.theme}
            reducedMotion={context.reducedMotion}
          />
          <div className="rf-library-paper" aria-hidden="true">
            <FileText size={32} />
            <span />
            <span />
            <span />
            <span />
          </div>
          <div>
            <h2 id="rf-library-start-title">Your next chapter starts here</h2>
            <p>
              Upload your resume or begin with a blank page. Keep every version
              in one place.
            </p>
          </div>
          <div className="rf-library-start-actions">
            <Button
              onClick={() => {
                setUploadOpen(true);
              }}
              disabled={
                creating ||
                loadingMore ||
                deleting ||
                restoring ||
                !!downloading
              }
            >
              <Upload size={17} /> Upload resume
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                void create();
              }}
              disabled={
                creating ||
                loadingMore ||
                deleting ||
                restoring ||
                !!downloading
              }
            >
              <FilePlus2 size={17} />
              {creating ? (
                <RequestFeedback
                  label="Creating"
                  reducedMotion={context.reducedMotion}
                />
              ) : (
                "Create resume"
              )}
            </Button>
          </div>
        </GlassCardSurface>
        <section className="rf-library-collection" aria-label="Saved resumes">
          <div className="rf-library-list-heading">
            <h2 ref={listHeading} tabIndex={-1}>
              Saved resumes
            </h2>
            <span>
              {loading
                ? "Loading…"
                : `${String(rows.length)} ${rows.length === 1 ? "resume" : "resumes"}`}
            </span>
          </div>
          <div className="rf-library-filters">
            <StudioPrompt
              hero
              quietSearch
              label="Search resumes"
              value={query}
              onChange={setQuery}
              onSubmit={() => listHeading.current?.focus()}
              maxLength={200}
              placeholder="Find a saved resume"
              submitLabel="Search"
            />
            <label className="rf-library-sort">
              Sort by
              <select
                aria-label="Sort resumes"
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                }}
              >
                <option value="updated">Last updated</option>
                <option value="title">Name</option>
              </select>
            </label>
          </div>
          {notice ? (
            <div className="rf-library-notice" role="status">
              <p>{notice}</p>
              {deletedRow ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={restoring || !!downloading || deleting}
                  onClick={() => {
                    void restore();
                  }}
                >
                  {restoring ? "Restoring…" : "Undo delete"}
                </Button>
              ) : null}
            </div>
          ) : null}
          {error ? (
            <div className="rf-library-error" role="alert">
              <p>{error}</p>
              <Button
                variant="outline"
                onClick={() => {
                  setRetry((v) => v + 1);
                }}
                disabled={loading || deleting || restoring || !!downloading}
              >
                Retry loading
              </Button>
            </div>
          ) : null}
          {loading ? (
            <div className="rf-library-empty">
              <StudioLoading
                compact
                reducedMotion={context.reducedMotion}
              />
            </div>
          ) : !shown.length ? (
            <div className="rf-library-empty">
              <FileText size={30} />
              <h3>
                {query
                  ? "No matching resumes"
                  : "Your first resume starts here"}
              </h3>
              <p>
                {query
                  ? "Try a different name or clear your search."
                  : "Upload your resume or create a blank one above. No profile setup needed."}
              </p>
              {query ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setQuery("");
                  }}
                >
                  Clear search
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="rf-library-table-wrap">
              <table className="rf-library-table">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Saved version</th>
                    <th scope="col">Updated</th>
                    <th scope="col">
                      <span className="rf-visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <button
                          className="rf-library-name"
                          onClick={() =>
                            context.onNavigate?.(`${prefix}/${r.id}`)
                          }
                        >
                          <span className="rf-library-file-icon">
                            <FileText size={21} />
                          </span>
                          <span>
                            {r.title}
                            <small
                              title={
                                r.status === "draft"
                                  ? "Saved to your account; reopen to keep editing."
                                  : undefined
                              }
                            >
                              <DocumentStatus>
                                {r.status === "draft" ? "Saved" : r.status}
                              </DocumentStatus>
                            </small>
                          </span>
                        </button>
                      </td>
                      <td>
                        <span className="rf-library-version">
                          Version {r.currentVersion}
                        </span>
                      </td>
                      <td>
                        <time dateTime={r.updatedAt}>
                          {new Intl.DateTimeFormat(undefined, {
                            dateStyle: "medium",
                          }).format(new Date(r.updatedAt))}
                        </time>
                      </td>
                      <td>
                        <div className="rf-library-row-actions">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={
                              downloading === r.id
                                ? `Preparing ${r.title} as PDF`
                                : `Download ${r.title} as PDF`
                            }
                            aria-busy={downloading === r.id}
                            title={
                              downloading === r.id
                                ? "Preparing PDF…"
                                : "Download saved version as PDF"
                            }
                            disabled={
                              creating ||
                              loadingMore ||
                              !!downloading ||
                              deleting ||
                              restoring
                            }
                            onClick={() => {
                              void download(r);
                            }}
                          >
                            {downloading === r.id ? (
                              <span aria-hidden="true">…</span>
                            ) : (
                              <Download size={18} aria-hidden="true" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rf-library-delete"
                            aria-label={`Delete ${r.title}`}
                            title="Delete resume"
                            disabled={
                              creating ||
                              loadingMore ||
                              !!downloading ||
                              deleting ||
                              restoring
                            }
                            onClick={() => {
                              setDeleteError("");
                              setDeleteTarget(r);
                            }}
                          >
                            <Trash2 size={18} aria-hidden="true" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {more ? (
            <Button
              variant="outline"
              disabled={
                loadingMore || loading || deleting || restoring || !!downloading
              }
              onClick={() => {
                void loadMore();
              }}
            >
              {loadingMore ? "Loading…" : "Load more resumes"}
            </Button>
          ) : null}
        </section>
      </div>
      {uploadOpen ? (
        <ResumeImportDialog
          context={context}
          api={api}
          onClose={() => {
            setUploadOpen(false);
            if (initialUploadOpen) context.onNavigate?.(prefix);
          }}
        />
      ) : null}
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setDeleteTarget(null);
            setDeleteError("");
          }
        }}
        title="Delete this resume?"
        resourceName={deleteTarget?.title}
        description={`Remove saved version ${String(deleteTarget?.currentVersion ?? "")} from your resumes. You can undo your most recent deletion while this page is open.`}
        confirmLabel="Delete resume"
        loading={deleting}
        error={deleteError}
        onConfirm={() => {
          void remove();
        }}
      />
    </div>
  );
}
