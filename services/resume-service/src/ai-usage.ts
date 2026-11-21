/**
 * Per-user and site-wide caps on paid Gemini requests.
 *
 * In-memory by design: the personal release runs one resume-service process,
 * so counts are exact between restarts and reset when the app restarts.
 */
export type AiAction = "tailoring" | "assessment" | "rewrite";

export type AiUsageLimits = {
  perDay: Record<AiAction, number>;
  perMinute: number;
  siteDaily: number;
};

export const DEFAULT_AI_USAGE_LIMITS: AiUsageLimits = {
  perDay: { tailoring: 5, assessment: 20, rewrite: 40 },
  perMinute: 6,
  siteDaily: 300,
};

const ENV_KEYS = {
  tailoring: "AI_LIMIT_TAILORING_PER_DAY",
  assessment: "AI_LIMIT_ASSESSMENT_PER_DAY",
  rewrite: "AI_LIMIT_REWRITE_PER_DAY",
  perMinute: "AI_LIMIT_PER_MINUTE",
  siteDaily: "AI_LIMIT_SITE_PER_DAY",
} as const;

const LABELS: Record<AiAction, string> = {
  tailoring: "tailoring runs",
  assessment: "job fit checks",
  rewrite: "AI rewrites",
};

/** Reads optional overrides; a set but invalid value fails startup instead of silently disabling a cap. */
export function aiUsageLimitsFromEnv(
  env: Record<string, string | undefined>,
): AiUsageLimits {
  const read = (key: string, fallback: number) => {
    const raw = env[key];
    if (raw === undefined || raw === "") return fallback;
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < 1 || value > 100_000)
      throw new Error(`${key} must be a whole number from 1 to 100000.`);
    return value;
  };
  const d = DEFAULT_AI_USAGE_LIMITS;
  return {
    perDay: {
      tailoring: read(ENV_KEYS.tailoring, d.perDay.tailoring),
      assessment: read(ENV_KEYS.assessment, d.perDay.assessment),
      rewrite: read(ENV_KEYS.rewrite, d.perDay.rewrite),
    },
    perMinute: read(ENV_KEYS.perMinute, d.perMinute),
    siteDaily: read(ENV_KEYS.siteDaily, d.siteDaily),
  };
}

export type AiUsageDecision =
  | { allowed: true; release: () => void }
  | { allowed: false; retryAfterSeconds: number; message: string };

export function createAiUsageLimiter(
  limits: AiUsageLimits = DEFAULT_AI_USAGE_LIMITS,
  now: () => number = Date.now,
) {
  const DAY = 86_400_000;
  const MINUTE = 60_000;
  let day = -1;
  let site = 0;
  const daily = new Map<string, Record<AiAction, number>>();
  const recent = new Map<string, number[]>();

  return {
    reserve(userId: string, action: AiAction): AiUsageDecision {
      const time = now();
      const today = Math.floor(time / DAY);
      if (today !== day) {
        day = today;
        site = 0;
        daily.clear();
      }
      const untilTomorrow = Math.max(
        1,
        Math.ceil(((today + 1) * DAY - time) / 1000),
      );
      for (const [key, stamps] of recent) {
        const kept = stamps.filter((stamp) => time - stamp < MINUTE);
        if (kept.length) recent.set(key, kept);
        else recent.delete(key);
      }
      const used = daily.get(userId) ?? {
        tailoring: 0,
        assessment: 0,
        rewrite: 0,
      };
      const stamps = recent.get(userId) ?? [];
      if (site >= limits.siteDaily)
        return {
          allowed: false,
          retryAfterSeconds: untilTomorrow,
          message:
            "AI features reached today's site-wide limit. Try again after 00:00 UTC. Editing and PDF export still work.",
        };
      if (used[action] >= limits.perDay[action])
        return {
          allowed: false,
          retryAfterSeconds: untilTomorrow,
          message: `Daily limit reached: ${String(limits.perDay[action])} ${LABELS[action]} per day. Try again after 00:00 UTC.`,
        };
      if (stamps.length >= limits.perMinute) {
        const oldest = stamps[0] ?? time;
        const wait = Math.max(1, Math.ceil((oldest + MINUTE - time) / 1000));
        return {
          allowed: false,
          retryAfterSeconds: wait,
          message: `Too many AI requests. Wait ${String(wait)} seconds and retry.`,
        };
      }
      used[action] += 1;
      site += 1;
      daily.set(userId, used);
      stamps.push(time);
      recent.set(userId, stamps);
      let released = false;
      return {
        allowed: true,
        // Refund a request rejected before any provider call (invalid input, conflict, not found).
        release: () => {
          if (released || Math.floor(now() / DAY) !== today) return;
          released = true;
          site = Math.max(0, site - 1);
          const current = daily.get(userId);
          if (current) current[action] = Math.max(0, current[action] - 1);
          const list = recent.get(userId);
          const index = list?.indexOf(time) ?? -1;
          if (list && index >= 0) list.splice(index, 1);
        },
      };
    },
  };
}

export type AiUsageLimiter = ReturnType<typeof createAiUsageLimiter>;
