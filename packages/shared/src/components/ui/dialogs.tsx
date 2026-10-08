import {
  useEffect,
  useId,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "../../utils/cn";
import { Button } from "./primitives";

// ── Focus trap & restoration helper ───────────────────────────────────

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useModalFocusManagement(open: boolean, onClose: () => void) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    if (
      typeof document !== "undefined" &&
      document.activeElement instanceof HTMLElement
    ) {
      previousFocusRef.current = document.activeElement;
    }

    const container = dialogRef.current;
    if (container) {
      const firstFocusable =
        container.querySelector<HTMLElement>("[data-modal-initial-focus]") ??
        container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (firstFocusable ?? container).focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key === "Tab" && dialogRef.current) {
        const focusables = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (!first || !last) return;

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [open]);

  return dialogRef;
}

// ── Dialog ────────────────────────────────────────────────────────────

export interface DialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly className?: string;
  readonly bodyClassName?: string;
  readonly footerClassName?: string;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  bodyClassName,
  footerClassName,
}: DialogProps) {
  const baseId = useId();
  const titleId = `rf-dialog-title-${baseId}`;
  const descId = description ? `rf-dialog-desc-${baseId}` : undefined;
  const dialogRef = useModalFocusManagement(open, () => {
    onOpenChange(false);
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      <div
        aria-hidden="true"
        onClick={() => {
          onOpenChange(false);
        }}
        className="fixed inset-0 bg-black/50 backdrop-blur-xs"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        className={cn(
          "relative z-10 w-full max-w-lg rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)] p-6 text-[var(--foreground)] shadow-xl rf-panel-transition",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold leading-snug">
              {title}
            </h2>
            {description ? (
              <p
                id={descId}
                className="mt-1 text-sm text-[var(--muted-foreground)]"
              >
                {description}
              </p>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close dialog"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <div className={cn("mt-4", bodyClassName)}>{children}</div>

        {footer ? (
          <div className={cn("mt-6 flex justify-end gap-3", footerClassName)}>
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── AlertDialog / ConfirmDeleteDialog ─────────────────────────────────

export interface ConfirmDeleteDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description: string;
  readonly resourceName?: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly loading?: boolean;
  readonly error?: string;
  readonly onConfirm: () => void;
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  resourceName,
  confirmLabel = "Delete permanently",
  cancelLabel = "Cancel",
  loading = false,
  error,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const baseId = useId();
  const titleId = `rf-alert-title-${baseId}`;
  const descId = `rf-alert-desc-${baseId}`;
  const dialogRef = useModalFocusManagement(open, () => {
    if (!loading) onOpenChange(false);
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      <div
        aria-hidden="true"
        onClick={() => {
          if (!loading) onOpenChange(false);
        }}
        className="fixed inset-0 bg-black/55 backdrop-blur-xs"
      />
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        className="relative z-10 w-full max-w-md rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)] p-6 text-[var(--foreground)] shadow-xl rf-panel-transition"
      >
        <div className="flex items-start gap-3">
          <div
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--destructive)]/15 text-[var(--destructive)]"
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 id={titleId} className="text-base font-semibold">
              {title}
            </h2>
            <p
              id={descId}
              className="mt-1.5 text-sm text-[var(--muted-foreground)]"
            >
              {description}
            </p>
            {resourceName ? (
              <p className="mt-2 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 font-mono text-xs text-[var(--foreground)]">
                Target: {resourceName}
              </p>
            ) : null}
          </div>
        </div>

        {error ? (
          <p role="alert" className="mt-4 text-sm text-[var(--destructive)]">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-3">
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => {
              onOpenChange(false);
            }}
          >
            {cancelLabel}
          </Button>
          <Button
            variant="destructive"
            loading={loading}
            loadingText="Deleting…"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── DropdownMenu ──────────────────────────────────────────────────────

export interface DropdownMenuItem {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly destructive?: boolean;
  readonly disabled?: boolean;
  readonly onSelect: () => void;
}

export interface DropdownMenuProps {
  readonly triggerLabel: ReactNode;
  readonly ariaLabel?: string;
  readonly items: readonly DropdownMenuItem[];
  readonly align?: "left" | "right";
  readonly className?: string;
}

export function DropdownMenu({
  triggerLabel,
  ariaLabel,
  items,
  align = "right",
  className,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        event.target instanceof Node &&
        !containerRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
    };
  }, [open]);

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }

    const menuEl = menuRef.current;
    if (!menuEl) return;
    const buttons = Array.from(
      menuEl.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]:not(:disabled)',
      ),
    );
    if (buttons.length === 0) return;

    const currentIndex = buttons.findIndex((b) => b === document.activeElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = buttons[(currentIndex + 1) % buttons.length];
      next?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const prev =
        buttons[(currentIndex - 1 + buttons.length) % buttons.length];
      prev?.focus();
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-block text-left", className)}
    >
      <Button
        ref={triggerRef}
        variant="outline"
        size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => {
          setOpen((prev) => !prev);
        }}
      >
        {triggerLabel}
      </Button>

      {open ? (
        <div
          ref={menuRef}
          role="menu"
          onKeyDown={handleMenuKeyDown}
          className={cn(
            "absolute z-40 mt-1.5 w-56 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-lg rf-panel-transition",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
                triggerRef.current?.focus();
              }}
              className={cn(
                "flex w-full flex-col items-start rounded-md px-3 py-2 text-left text-sm transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
                item.destructive
                  ? "text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
                  : "text-[var(--foreground)] hover:bg-[var(--surface-muted)]",
              )}
            >
              <span className="font-medium">{item.label}</span>
              {item.description ? (
                <span className="text-xs text-[var(--muted-foreground)]">
                  {item.description}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── StatusBanner / Toast announcement ─────────────────────────────────

export type StatusBannerTone = "info" | "success" | "warning" | "error";

export interface StatusBannerProps extends HTMLAttributes<HTMLDivElement> {
  readonly tone?: StatusBannerTone;
  readonly showToneLabel?: boolean;
  readonly title: string;
  readonly description?: string;
  readonly onDismiss?: () => void;
}

const TONE_LABELS: Record<StatusBannerTone, string> = {
  info: "Notice",
  success: "Success",
  warning: "Warning",
  error: "Error",
};

export function StatusBanner({
  tone = "info",
  showToneLabel = true,
  title,
  description,
  onDismiss,
  className,
  ...props
}: StatusBannerProps) {
  const isError = tone === "error";

  const Icon =
    tone === "success"
      ? CheckCircle2
      : tone === "warning" || tone === "error"
        ? AlertTriangle
        : Info;

  const toneStyles: Record<StatusBannerTone, string> = {
    info: "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]",
    success:
      "border-[var(--success)]/40 bg-[var(--surface)] text-[var(--foreground)]",
    warning:
      "border-[var(--warning)]/40 bg-[var(--surface)] text-[var(--foreground)]",
    error:
      "border-[var(--destructive)]/50 bg-[var(--surface)] text-[var(--foreground)]",
  };

  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      className={cn(
        "flex items-start justify-between gap-3 rounded-[var(--radius-card)] border p-4 shadow-xs",
        toneStyles[tone],
        className,
      )}
      {...props}
    >
      <div className="flex items-start gap-3">
        <Icon
          aria-hidden="true"
          className={cn(
            "mt-0.5 h-5 w-5 shrink-0",
            tone === "success" && "text-[var(--success)]",
            tone === "warning" && "text-[var(--warning)]",
            tone === "error" && "text-[var(--destructive)]",
            tone === "info" && "text-[var(--primary)]",
          )}
        />
        <div>
          <div className="flex items-center gap-2">
            {showToneLabel ? (
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                {TONE_LABELS[tone]}
              </span>
            ) : null}
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {title}
            </p>
          </div>
          {description ? (
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              {description}
            </p>
          ) : null}
        </div>
      </div>

      {onDismiss ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Dismiss notification"
          onClick={onDismiss}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}
