import {
  createContext,
  forwardRef,
  useContext,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type LabelHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TableHTMLAttributes,
  type TdHTMLAttributes,
  type TextareaHTMLAttributes,
  type ThHTMLAttributes,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { Button as PerformativeButton } from "performative-ui";
import { cn } from "../../utils/cn";

// ── Button ────────────────────────────────────────────────────────────

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] font-medium text-sm rf-interactive-lift cursor-pointer select-none disabled:pointer-events-none disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)] shadow-xs",
        secondary:
          "bg-[var(--surface-muted)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--border)]/60",
        outline:
          "bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--surface-muted)]",
        ghost:
          "bg-transparent text-[var(--foreground)] hover:bg-[var(--surface-muted)]",
        destructive:
          "bg-[var(--destructive)] text-[var(--destructive-foreground)] hover:opacity-90 shadow-xs",
        success:
          "bg-[var(--success)] text-[var(--success-foreground)] hover:opacity-90 shadow-xs",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 py-2 text-sm",
        lg: "h-11 px-6 text-base",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  readonly glow?: boolean;
  readonly loading?: boolean;
  readonly loadingText?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      glow = false,
      loading = false,
      loadingText,
      disabled,
      children,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const isDisabled = Boolean(disabled) || loading;
    return (
      <PerformativeButton
        variant={glow ? "glow" : "solid"}
        sparkle={glow}
        data-variant={variant ?? "default"}
        data-size={size ?? "md"}
        size={size === "icon" || size == null ? "md" : size}
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        aria-disabled={isDisabled || undefined}
        className={cn(
          "rf-button",
          glow && "rf-ai-action",
          buttonVariants({ variant, size }),
          className,
        )}
        {...props}
      >
        {loading ? (
          <>
            <Loader2
              className="h-4 w-4 animate-spin shrink-0"
              aria-hidden="true"
            />
            <span>{loadingText ?? children}</span>
          </>
        ) : (
          children
        )}
      </PerformativeButton>
    );
  },
);
Button.displayName = "Button";

// ── Label ─────────────────────────────────────────────────────────────

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  readonly requiredIndicator?: boolean;
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, requiredIndicator, children, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "block text-sm font-medium text-[var(--foreground)] leading-snug",
        className,
      )}
      {...props}
    >
      {children}
      {requiredIndicator ? (
        <span className="ml-1 text-[var(--destructive)]" aria-hidden="true">
          *
        </span>
      ) : null}
    </label>
  ),
);
Label.displayName = "Label";

// ── Input ─────────────────────────────────────────────────────────────

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      aria-invalid={invalid || props["aria-invalid"] || undefined}
      className={cn(
        "flex h-10 w-full rounded-[var(--radius-control)] border bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        invalid
          ? "border-[var(--destructive)] focus-visible:outline-[var(--destructive)]"
          : "border-[var(--border)] focus-visible:outline-[var(--ring)]",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

// ── Textarea ──────────────────────────────────────────────────────────

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  readonly invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, rows = 3, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || props["aria-invalid"] || undefined}
      className={cn(
        "flex min-h-[84px] w-full rounded-[var(--radius-control)] border bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        invalid
          ? "border-[var(--destructive)] focus-visible:outline-[var(--destructive)]"
          : "border-[var(--border)] focus-visible:outline-[var(--ring)]",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

// ── FormField & FieldError ────────────────────────────────────────────

export interface FieldErrorProps extends HTMLAttributes<HTMLParagraphElement> {
  readonly message?: string;
}

export function FieldError({
  message,
  className,
  children,
  ...props
}: FieldErrorProps) {
  const content = message ?? children;
  if (!content) return null;
  return (
    <p
      role="alert"
      className={cn(
        "mt-1.5 text-xs font-medium text-[var(--destructive)]",
        className,
      )}
      {...props}
    >
      {content}
    </p>
  );
}

export interface FormFieldProps {
  readonly id?: string;
  readonly label: string;
  readonly description?: string;
  readonly error?: string;
  readonly required?: boolean;
  readonly className?: string;
  readonly children: (fieldProps: {
    id: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
    invalid: boolean;
  }) => ReactNode;
}

export function FormField({
  id: providedId,
  label,
  description,
  error,
  required,
  className,
  children,
}: FormFieldProps) {
  const generatedId = useId();
  const id = providedId ?? `rf-field-${generatedId}`;
  const descId = description ? `${id}-desc` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [descId, errId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} requiredIndicator={required}>
        {label}
      </Label>
      {description ? (
        <p id={descId} className="text-xs text-[var(--muted-foreground)]">
          {description}
        </p>
      ) : null}
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": Boolean(error) || undefined,
        invalid: Boolean(error),
      })}
      {error ? <FieldError id={errId} message={error} /> : null}
    </div>
  );
}

// ── Select ────────────────────────────────────────────────────────────

export interface SelectOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  readonly options: readonly SelectOption[];
  readonly invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, invalid, ...props }, ref) => (
    <select
      ref={ref}
      aria-invalid={invalid || props["aria-invalid"] || undefined}
      className={cn(
        "flex h-10 w-full rounded-[var(--radius-control)] border bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        invalid
          ? "border-[var(--destructive)] focus-visible:outline-[var(--destructive)]"
          : "border-[var(--border)] focus-visible:outline-[var(--ring)]",
        className,
      )}
      {...props}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} disabled={opt.disabled}>
          {opt.label}
        </option>
      ))}
    </select>
  ),
);
Select.displayName = "Select";

// ── Checkbox ──────────────────────────────────────────────────────────

export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> {
  readonly label: string;
  readonly description?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, description, id: providedId, ...props }, ref) => {
    const generatedId = useId();
    const id = providedId ?? `rf-checkbox-${generatedId}`;
    const descId = description ? `${id}-desc` : undefined;

    return (
      <div className={cn("flex items-start gap-2.5", className)}>
        <input
          ref={ref}
          id={id}
          type="checkbox"
          aria-describedby={descId}
          className="mt-0.5 h-4 w-4 rounded border-[var(--border)] accent-[var(--primary)] cursor-pointer disabled:cursor-not-allowed"
          {...props}
        />
        <div className="text-sm leading-tight">
          <label
            htmlFor={id}
            className="font-medium text-[var(--foreground)] cursor-pointer"
          >
            {label}
          </label>
          {description ? (
            <p
              id={descId}
              className="mt-0.5 text-xs text-[var(--muted-foreground)]"
            >
              {description}
            </p>
          ) : null}
        </div>
      </div>
    );
  },
);
Checkbox.displayName = "Checkbox";

// ── Card ──────────────────────────────────────────────────────────────

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-xs",
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";

export const CardHeader = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-5", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

export const CardTitle = forwardRef<
  HTMLHeadingElement,
  HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-base font-semibold leading-snug tracking-tight",
      className,
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

export const CardDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-[var(--muted-foreground)]", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

export const CardContent = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-5 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

export const CardFooter = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center gap-3 p-5 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

// ── Badge ─────────────────────────────────────────────────────────────

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--primary)] text-[var(--primary-foreground)] border-transparent",
        secondary:
          "bg-[var(--surface-muted)] text-[var(--foreground)] border-[var(--border)]",
        outline:
          "bg-transparent text-[var(--foreground)] border-[var(--border)]",
        success:
          "bg-[var(--success)] text-[var(--success-foreground)] border-transparent",
        warning:
          "bg-[var(--warning)] text-[var(--warning-foreground)] border-transparent",
        destructive:
          "bg-[var(--destructive)] text-[var(--destructive-foreground)] border-transparent",
      },
    },
    defaultVariants: {
      variant: "secondary",
    },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

// ── Tabs (WAI-ARIA keyboard navigable) ────────────────────────────────

interface TabsContextValue {
  readonly baseId: string;
  readonly activeTab: string;
  readonly setActiveTab: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

export interface TabsProps extends HTMLAttributes<HTMLDivElement> {
  readonly value?: string;
  readonly defaultValue: string;
  readonly onValueChange?: (value: string) => void;
}

export function Tabs({
  value,
  defaultValue,
  onValueChange,
  className,
  children,
  ...props
}: TabsProps) {
  const baseId = useId();
  const [internalValue, setInternalValue] = useState(defaultValue);
  const activeTab = value ?? internalValue;

  const setActiveTab = (next: string) => {
    if (value === undefined) {
      setInternalValue(next);
    }
    onValueChange?.(next);
  };

  return (
    <TabsContext.Provider value={{ baseId, activeTab, setActiveTab }}>
      <div className={cn("w-full", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabsList({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  const listRef = useRef<HTMLDivElement | null>(null);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const container = listRef.current;
    if (!container) return;
    const triggers = Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        '[role="tab"]:not(:disabled)',
      ),
    );
    if (triggers.length === 0) return;

    const currentIndex = triggers.findIndex(
      (el) => el === document.activeElement,
    );
    if (currentIndex === -1) return;

    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % triggers.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + triggers.length) % triggers.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = triggers.length - 1;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      const target = triggers[nextIndex];
      target?.focus();
      target?.click();
    }
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      onKeyDown={handleKeyDown}
      className={cn(
        "inline-flex items-center gap-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-muted)] p-1",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface TabsTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly value: string;
}

export function TabsTrigger({
  value,
  className,
  children,
  ...props
}: TabsTriggerProps) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("TabsTrigger must be used within Tabs");
  const isSelected = ctx.activeTab === value;
  const tabId = `${ctx.baseId}-tab-${value}`;
  const panelId = `${ctx.baseId}-panel-${value}`;

  return (
    <button
      id={tabId}
      type="button"
      role="tab"
      aria-selected={isSelected}
      aria-controls={panelId}
      tabIndex={isSelected ? 0 : -1}
      onClick={() => {
        ctx.setActiveTab(value);
      }}
      className={cn(
        "inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer",
        isSelected
          ? "bg-[var(--surface)] text-[var(--foreground)] shadow-xs"
          : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
  readonly value: string;
}

export function TabsContent({
  value,
  className,
  children,
  ...props
}: TabsContentProps) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("TabsContent must be used within Tabs");
  const isSelected = ctx.activeTab === value;
  const tabId = `${ctx.baseId}-tab-${value}`;
  const panelId = `${ctx.baseId}-panel-${value}`;

  if (!isSelected) return null;

  return (
    <div
      id={panelId}
      role="tabpanel"
      aria-labelledby={tabId}
      tabIndex={0}
      className={cn("mt-3 rf-panel-transition", className)}
      {...props}
    >
      {children}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────

export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-[var(--radius-control)] bg-[var(--surface-muted)] border border-[var(--border)]/60",
        className,
      )}
      {...props}
    />
  );
}

// ── Table ─────────────────────────────────────────────────────────────

export function Table({
  className,
  ...props
}: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]">
      <table
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}

export function TableHeader({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        "border-b border-[var(--border)] bg-[var(--surface-muted)]",
        className,
      )}
      {...props}
    />
  );
}

export function TableBody({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={cn("divide-y divide-[var(--border)]", className)}
      {...props}
    />
  );
}

export function TableRow({
  className,
  ...props
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "transition-colors hover:bg-[var(--surface-muted)]/60",
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "h-10 px-4 text-left align-middle font-semibold text-xs uppercase tracking-wider text-[var(--muted-foreground)]",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn("p-4 align-middle text-[var(--foreground)]", className)}
      {...props}
    />
  );
}

// ── Tooltip ───────────────────────────────────────────────────────────

export interface TooltipProps {
  readonly content: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
}

export function Tooltip({ content, children, className }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  return (
    <span
      className={cn("relative inline-flex items-center", className)}
      onMouseEnter={() => {
        setOpen(true);
      }}
      onMouseLeave={() => {
        setOpen(false);
      }}
      onFocus={() => {
        setOpen(true);
      }}
      onBlur={() => {
        setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <span aria-describedby={open ? tooltipId : undefined}>{children}</span>
      {open ? (
        <span
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)] shadow-md"
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}

// ── ScrollArea ────────────────────────────────────────────────────────

export interface ScrollAreaProps extends HTMLAttributes<HTMLDivElement> {
  readonly maxHeight?: string;
}

export function ScrollArea({
  maxHeight = "20rem",
  className,
  style,
  children,
  ...props
}: ScrollAreaProps) {
  return (
    <div
      tabIndex={0}
      style={{ maxHeight, ...style }}
      className={cn(
        "overflow-y-auto rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-3",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
