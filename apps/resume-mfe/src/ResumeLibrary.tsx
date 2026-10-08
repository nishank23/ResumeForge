import { useEffect, useMemo, useRef, useState } from "react";
import {
  FilePlus2,
  FileText,
  Search,
  Upload,
  ArrowUpRight,
} from "lucide-react";
import {
  Button,
  useSession,
  type ShellFederationContext,
} from "@resume-forge/shared";
import { blankResume, createResumeApi, type ResumeRow } from "./resume-api";
import "./resume-library.css";

export function ResumeLibrary({
  context,
}: {
  context: ShellFederationContext;
}) {
  const { requestApi, state } = useSession();
  const api = useMemo(
    () => createResumeApi(requestApi, context.activeWorkspace.id),
    [requestApi, context.activeWorkspace.id],
  );
  const [rows, setRows] = useState<ResumeRow[]>([]),
    [query, setQuery] = useState("");
  const [sort, setSort] = useState("updated"),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [creating, setCreating] = useState(false),
    [retry, setRetry] = useState(0);
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
        <p>Your documents. Your next chapter.</p>
      </div>
      <section
        className="rf-library-start"
        aria-labelledby="rf-library-start-title"
      >
        <div className="rf-library-paper" aria-hidden="true">
          <FileText size={32} />
          <span />
          <span />
          <span />
          <span />
        </div>
        <div>
          <h2 id="rf-library-start-title">Start with what you’ve done.</h2>
          <p>
            Bring your own resume, or build one from a blank page.
            <br />
            Your saved work stays here when you come back.
          </p>
        </div>
        <div className="rf-library-start-actions">
          <Button
            onClick={() => context.onNavigate?.(`${prefix}/upload`)}
            disabled={creating || loadingMore}
          >
            <Upload size={17} /> Upload resume
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              void create();
            }}
            disabled={creating || loadingMore}
          >
            <FilePlus2 size={17} />
            {creating ? "Creating…" : "Create resume"}
          </Button>
        </div>
      </section>
      <div className="rf-library-list-heading">
        <h2>Continue where you left off</h2>
        <span>
          {loading
            ? "Loading…"
            : `${String(rows.length)} ${rows.length === 1 ? "resume" : "resumes"}`}
        </span>
      </div>
      <div className="rf-library-filters">
        <label className="rf-library-search">
          <Search size={19} />
          <input
            aria-label="Search loaded resumes"
            placeholder="Search loaded resumes"
            value={query}
            maxLength={200}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
          />
        </label>
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
      {error ? (
        <div className="rf-library-error" role="alert">
          <p>{error}</p>
          <Button
            variant="outline"
            onClick={() => {
              setRetry((v) => v + 1);
            }}
            disabled={loading}
          >
            Retry loading
          </Button>
        </div>
      ) : null}
      {loading ? (
        <div className="rf-library-empty" role="status">
          Loading your saved resumes…
        </div>
      ) : !shown.length ? (
        <div className="rf-library-empty">
          <FileText size={30} />
          <h3>
            {query ? "No matching resumes" : "Your first resume starts here"}
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
                      onClick={() => context.onNavigate?.(`${prefix}/${r.id}`)}
                    >
                      <span className="rf-library-file-icon">
                        <FileText size={21} />
                      </span>
                      <span>
                        {r.title}
                        <small>
                          {r.status === "draft" ? "Draft" : r.status}
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
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Open ${r.title}`}
                      onClick={() => context.onNavigate?.(`${prefix}/${r.id}`)}
                    >
                      Open <ArrowUpRight size={16} />
                    </Button>
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
          disabled={loadingMore || loading}
          onClick={() => {
            void loadMore();
          }}
        >
          {loadingMore ? "Loading…" : "Load more resumes"}
        </Button>
      ) : null}
    </div>
  );
}
