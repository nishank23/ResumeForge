import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;
type PageView = "width" | "page" | "actual";

// Keep document line wrapping independent of the workspace and sidebar width.
// Zoom changes only the view; it never rewrites or trims resume content.
export function ResumePage({ children }: { children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<PageView>("page");
  const [size, setSize] = useState({
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    availableHeight: PAGE_HEIGHT,
  });
  useLayoutEffect(() => {
    const measure = () => {
      if (!viewport.current || !surface.current) return;
      // Selecting content after scrolling must not change the viewing scale.
      const documentTop =
        viewport.current.getBoundingClientRect().top + window.scrollY;
      const remainingHeight =
        documentTop >= window.innerHeight
          ? window.innerHeight - 24
          : window.innerHeight - documentTop - 24;
      const next = {
        width: viewport.current.clientWidth,
        height: Math.max(PAGE_HEIGHT, surface.current.offsetHeight),
        availableHeight: Math.max(96, remainingHeight),
      };
      setSize((current) =>
        current.width === next.width &&
        current.height === next.height &&
        current.availableHeight === next.availableHeight
          ? current
          : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (viewport.current) observer.observe(viewport.current);
    if (surface.current) observer.observe(surface.current);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [children]);
  const widthScale = Math.min(1, size.width / PAGE_WIDTH);
  const scale =
    view === "actual"
      ? 1
      : view === "page"
        ? Math.min(widthScale, size.availableHeight / size.height)
        : widthScale;
  const pages = Math.ceil(size.height / PAGE_HEIGHT);
  return (
    <div className="rf-page-viewer">
      <div className="rf-page-view-controls" aria-label="Resume page zoom">
        <span>
          A4 · {pages} {pages === 1 ? "page" : "pages"}
        </span>
        <div>
          {(
            [
              ["width", "Fit width"],
              ["page", "Fit page"],
              ["actual", "100%"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={view === value}
              onClick={() => {
                setView(value);
              }}
            >
              {label}
            </button>
          ))}
          <output aria-label="Current zoom">{Math.round(scale * 100)}%</output>
        </div>
      </div>
      {pages > 1 ? (
        <p className="rf-page-overflow" role="status">
          Content exceeds one A4 page. Adjust spacing in Customize Template; all
          text is kept.
        </p>
      ) : null}
      <div ref={viewport} className="rf-page-viewport">
        <div
          className="rf-page-zoom-frame"
          style={{ width: PAGE_WIDTH * scale, height: size.height * scale }}
        >
          <div
            ref={surface}
            className="rf-page-zoom-surface"
            style={{ transform: `scale(${String(scale)})` }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
