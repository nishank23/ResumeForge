export interface ProfessionalProfile {
  id: string;
  fullName: string;
  location: string | null;
  professionalSummary: string | null;
  revision: number;
}
export interface ProfessionalFields {
  fullName: string;
  location: string;
  professionalSummary: string;
}
export type ProfileRequest = (
  path: string,
  options?: RequestInit,
) => Promise<Response>;
export class ProfileApiError extends Error {
  readonly code: string;
  constructor(code: string) {
    super("Profile request failed");
    this.code = code;
  }
}
const uuid =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
function parseProfile(value: unknown): ProfessionalProfile {
  if (!value || typeof value !== "object")
    throw new ProfileApiError("unavailable");
  const data = value as Record<string, unknown>;
  const bounded = (field: unknown, limit: number) =>
    field === null || (typeof field === "string" && field.length <= limit);
  if (
    Object.keys(data).sort().join(",") !==
      "fullName,id,location,professionalSummary,revision" ||
    typeof data.id !== "string" ||
    !uuid.test(data.id) ||
    typeof data.fullName !== "string" ||
    !data.fullName.trim() ||
    data.fullName.length > 200 ||
    !bounded(data.location, 200) ||
    !bounded(data.professionalSummary, 5000) ||
    typeof data.revision !== "number" ||
    !Number.isInteger(data.revision) ||
    data.revision < 1 ||
    data.revision > 2147483647
  )
    throw new ProfileApiError("unavailable");
  return data as unknown as ProfessionalProfile;
}
export function profileFields(
  profile: ProfessionalProfile | null,
): ProfessionalFields {
  return {
    fullName: profile?.fullName ?? "",
    location: profile?.location ?? "",
    professionalSummary: profile?.professionalSummary ?? "",
  };
}
export function validateFields(
  fields: ProfessionalFields,
): Partial<Record<keyof ProfessionalFields, string>> {
  const errors: Partial<Record<keyof ProfessionalFields, string>> = {};
  if (!fields.fullName.trim()) errors.fullName = "Enter your full name.";
  else if (fields.fullName.trim().length > 200)
    errors.fullName = "Use 200 characters or fewer.";
  if (fields.location.trim().length > 200)
    errors.location = "Use 200 characters or fewer.";
  if (fields.professionalSummary.trim().length > 5000)
    errors.professionalSummary = "Use 5,000 characters or fewer.";
  return errors;
}
export function createProfileClient(
  request: ProfileRequest,
  workspaceId: string,
) {
  if (!uuid.test(workspaceId)) throw new ProfileApiError("forbidden");
  async function call(path: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers);
    headers.set("X-Workspace-Id", workspaceId);
    if (options.body) headers.set("Content-Type", "application/json");
    const response = await request(`/api/v1/profile${path}`, {
      ...options,
      headers,
    });
    const body: unknown = await response.json();
    if (!body || typeof body !== "object")
      throw new ProfileApiError("unavailable");
    if (!response.ok) {
      const error = "error" in body ? body.error : undefined;
      const code =
        error &&
        typeof error === "object" &&
        "code" in error &&
        typeof error.code === "string"
          ? error.code
          : "unavailable";
      throw new ProfileApiError(code);
    }
    return parseProfile("data" in body ? body.data : undefined);
  }
  return {
    async load(signal?: AbortSignal): Promise<ProfessionalProfile | null> {
      try {
        return await call("", { signal });
      } catch (error) {
        if (error instanceof ProfileApiError && error.code === "not_found")
          return null;
        throw error;
      }
    },
    async save(
      fields: ProfessionalFields,
      base: ProfessionalProfile | null,
      incomplete: boolean,
    ): Promise<ProfessionalProfile> {
      if (Object.keys(validateFields(fields)).length)
        throw new ProfileApiError("invalid_input");
      const values = {
        fullName: fields.fullName.trim(),
        location: fields.location.trim() || null,
        professionalSummary: fields.professionalSummary.trim() || null,
      };
      if (!base)
        return call("", { method: "POST", body: JSON.stringify(values) });
      if (base.revision >= 2147483647)
        throw new ProfileApiError("revision_conflict");
      const patch = incomplete
        ? Object.fromEntries(
            Object.entries(values).filter(
              ([key, value]) => value !== base[key as keyof typeof values],
            ),
          )
        : values;
      if (!Object.keys(patch).length) return base;
      return call(incomplete ? "/draft" : "", {
        method: "PUT",
        body: JSON.stringify({ ...patch, expectedRevision: base.revision }),
      });
    },
  };
}
