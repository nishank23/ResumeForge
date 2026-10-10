import { useEffect, useId, useRef, type CSSProperties } from "react";
import {
  AsciiHero,
  ChatBubble,
  Prompt,
  PromptHero,
  Temperature,
  TokenStream,
} from "performative-ui";
import {
  useDecorativeActivity,
  useMobileOrTouchViewport,
  useReducedMotion,
} from "../../utils/motion";
import { Button } from "./primitives";
import { Search } from "lucide-react";
import type { ThemeMode } from "@resume-forge/shared-types";

const palettes = {
  dark: ["#B89AFF", "#8A63DE", "#E3D6FF"],
  light: ["#6631C2", "#9672D2", "#49267F"],
};
const staticField = Array.from({ length: 24 }, (_, y) =>
  Array.from(
    { length: 110 },
    (_, x) =>
      " .,:;+~[]{}#/MW"[
        Math.floor(6 + 5 * Math.sin(x * 0.12 + y * 0.24) * Math.cos(y * 0.3))
      ],
  ).join(""),
).join("\n");

const fullScreenField = `${staticField
  .split("\n")
  .map((line) => line.repeat(3))
  .join("\n")}\n`.repeat(4);

/** Bounded, decorative canvas. Static ASCII remains on touch, quiet or hidden views. */
export function AsciiSpotlight({
  theme = "light",
  reducedMotion,
  bright = false,
  fullScreen = false,
}: {
  theme?: ThemeMode;
  reducedMotion?: boolean;
  bright?: boolean;
  fullScreen?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const quiet = useReducedMotion() || reducedMotion === true;
  const visible = useDecorativeActivity(host);
  const { isCompact, isCoarsePointer } = useMobileOrTouchViewport();
  const active = visible && !quiet && !isCompact && !isCoarsePointer;
  return (
    <div
      ref={host}
      aria-hidden="true"
      className="rf-ascii-spotlight rf-decorative-layer"
      data-decorative-state={active ? "canvas-active" : "static-fallback"}
    >
      <pre>{fullScreen ? fullScreenField : staticField}</pre>
      {active ? (
        <AsciiHero
          variant="bare"
          colorful
          palette={palettes[theme]}
          fontSize={11}
          baseOpacity={bright ? 0.55 : 0.34}
          spotlightOpacity={0.9}
          spotlightRadius={11}
          frameMs={100}
          reactive
          style={{ position: "absolute", inset: 0, background: "transparent" }}
        />
      ) : null}
    </div>
  );
}

/** Temperature is decorative; the outer meter is the only accessible score control. */
export function AssessmentMeter({
  value,
  label,
}: {
  value: number | null | undefined;
  label: string;
}) {
  const score = value == null ? null : Math.max(0, Math.min(100, value));
  const bands = ["low", "middle", "upper", "top"].map((key, index) => ({
    key,
    label: String(index * 25),
    color: "var(--primary)",
  }));
  return (
    <div className="rf-assessment-meter" data-unavailable={score === null}>
      <div className="rf-studio-score">
        <strong>{score ?? "—"}</strong>
        <span> / 100</span>
      </div>
      <div
        role={score === null ? "img" : "meter"}
        aria-label={score === null ? `${label}: not evaluated` : label}
        aria-valuemin={score === null ? undefined : 0}
        aria-valuemax={score === null ? undefined : 100}
        aria-valuenow={score ?? undefined}
      >
        <div inert aria-hidden="true" className="rf-temperature-display">
          <Temperature
            options={bands}
            value={
              bands[Math.min(3, Math.floor((score ?? 0) / 25))]?.key ?? "low"
            }
            style={
              {
                "--pui-temp-pos": (score ?? 0) / 100,
                "--pui-temp-cols": 4,
                "--pui-temp-divider": 0,
              } as CSSProperties
            }
          />
        </div>
      </div>
    </div>
  );
}

/** Only use for a real supported text action, with a named field and native submit guards. */
export function StudioPrompt({
  label,
  value,
  onChange,
  onSubmit,
  disabled = false,
  submitDisabled = false,
  maxLength = 12000,
  hero = false,
  quietSearch = false,
  placeholder,
  submitLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  submitDisabled?: boolean;
  maxLength?: number;
  hero?: boolean;
  quietSearch?: boolean;
  placeholder?: string;
  submitLabel: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    const field = host.current?.querySelector<
      HTMLInputElement | HTMLTextAreaElement
    >(hero ? "input" : "textarea");
    if (field) {
      field.id = id;
      field.setAttribute("aria-label", label);
      field.maxLength = maxLength;
      field.disabled = disabled;
    }
    const submit = host.current?.querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    );
    if (submit) {
      submit.disabled = disabled || submitDisabled;
      submit.setAttribute("aria-label", submitLabel);
    }
  }, [disabled, submitDisabled, hero, id, label, maxLength, submitLabel]);
  // Upstream 0.7.0 form may attach internal submit handlers. Capture gives one guarded submission.
  return (
    <div
      ref={host}
      className={`rf-studio-prompt${hero && quietSearch ? " rf-studio-search" : ""}`}
      onSubmitCapture={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!disabled && !submitDisabled) onSubmit();
      }}
      onKeyDownCapture={(event) => {
        if (
          event.key === "Enter" &&
          !event.nativeEvent.isComposing &&
          (hero || event.metaKey || event.ctrlKey)
        ) {
          event.preventDefault();
          event.stopPropagation();
          if (!disabled && !submitDisabled) onSubmit();
        }
      }}
    >
      <label htmlFor={id}>{label}</label>
      {hero ? (
        <>
          <PromptHero
            hideCta={quietSearch}
            leading={false}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            ctaLabel={submitLabel}
          />
          {quietSearch ? (
            <Button
              variant="outline"
              disabled={disabled || submitDisabled}
              onClick={() => {
                if (!disabled && !submitDisabled) onSubmit();
              }}
            >
              <Search size={16} aria-hidden="true" /> {submitLabel}
            </Button>
          ) : null}
        </>
      ) : (
        <Prompt
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          rows={4}
          hideAddContext
          hideVoice
          hideModel
          toolbarExtras={<span>{submitLabel}</span>}
        />
      )}
    </div>
  );
}

/** Playback of validated server text, not transport streaming or simulated reasoning. */
export function ValidatedResponse({
  text,
  reducedMotion,
}: {
  text: string;
  reducedMotion?: boolean;
}) {
  const quiet = useReducedMotion() || reducedMotion === true;
  return (
    <ChatBubble
      role="ai"
      thinking={false}
      icon={false}
      className="rf-validated-response"
    >
      <span className="rf-visually-hidden">{text}</span>
      <span aria-hidden="true">
        {quiet ? text : <TokenStream text={text} speedMs={12} hideCaret />}
      </span>
    </ChatBubble>
  );
}
