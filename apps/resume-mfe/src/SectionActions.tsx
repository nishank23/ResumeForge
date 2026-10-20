import {
  useLayoutEffect,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import type { DraftTarget, ResumeDraft } from "./editor-draft";

/** App-only actions; inline mode keeps controls outside printable paper. */
export function SectionActions({
  containerRef,
  toolbarRef,
  target,
  layoutKey,
  draft,
  hidden,
  onPointerEnter,
  children,
  inline = false,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  toolbarRef: RefObject<HTMLDivElement | null>;
  target: DraftTarget;
  layoutKey: string;
  draft: ResumeDraft;
  hidden: boolean;
  onPointerEnter: () => void;
  children: ReactNode;
  inline?: boolean;
}) {
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(
    null,
  );
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || hidden || inline) return;
    const sectionId = target.type === "header" ? null : target.sectionId;
    const entryId =
      target.type === "entry"
        ? target.itemId
        : target.type === "bullet"
          ? target.entryId
          : null;
    const section =
      sectionId === null
        ? container.querySelector<HTMLElement>("[data-editor-header]")
        : Array.from(
            container.querySelectorAll<HTMLElement>("[data-editor-section]"),
          ).find((element) => element.dataset.editorSection === sectionId);
    // Entry and achievement targets share their enclosing entry's footer.
    // Section headings and Summary retain the section footer.
    const regionElement =
      entryId === null
        ? section
        : Array.from(
            section?.querySelectorAll<HTMLElement>("[data-editor-entry]") ?? [],
          ).find((element) => element.dataset.editorEntry === entryId);
    if (!regionElement) {
      setAnchor(null);
      return;
    }
    const measure = () => {
      const bounds = container.getBoundingClientRect();
      const region = regionElement.getBoundingClientRect();
      const next = {
        top: region.bottom - bounds.top + 6,
        left: region.left - bounds.left + region.width / 2,
      };
      setAnchor((current) =>
        current?.top === next.top && current.left === next.left
          ? current
          : next,
      );
    };
    // ResizeObserver sees inline edits, font/layout changes and fit-width resizing.
    // Scroll needs no listener: target and overlay share the same scroll container.
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    const paper = container.querySelector(".rf-page-zoom-surface");
    if (paper) observer.observe(paper);
    if (section) observer.observe(section);
    observer.observe(regionElement);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [containerRef, target, layoutKey, draft, hidden, inline]);
  return (
    <div
      ref={toolbarRef}
      className={inline ? "rf-selected-actions" : "rf-floating-actions"}
      onPointerEnter={onPointerEnter}
      role="group"
      aria-label="Selected content actions"
      hidden={hidden || (!inline && !anchor)}
      style={inline ? undefined : (anchor ?? undefined)}
    >
      {children}
    </div>
  );
}
