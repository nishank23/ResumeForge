import { z } from "zod";

const fields = {
  fullName: z.string().trim().min(1).max(200),
  location: z.string().trim().max(200).nullable(),
  professionalSummary: z.string().trim().max(5_000).nullable(),
};
export const professionalProfileSchema = z
  .object({
    id: z.string().uuid(),
    ...fields,
    revision: z.number().int().positive().max(2_147_483_647),
  })
  .strict();
export const profileUpdateSchema = z
  .object({
    ...fields,
    expectedRevision: z.number().int().positive().max(2_147_483_646),
  })
  .strict();
export const profileCreateSchema = z
  .object({
    fullName: fields.fullName,
    location: fields.location.default(null),
    professionalSummary: fields.professionalSummary.default(null),
  })
  .strict();
export const profileDraftSchema = z
  .object({
    fullName: fields.fullName.optional(),
    location: fields.location.optional(),
    professionalSummary: fields.professionalSummary.optional(),
    expectedRevision: z.number().int().positive().max(2_147_483_646),
  })
  .strict()
  .refine(
    (input) =>
      input.fullName !== undefined ||
      input.location !== undefined ||
      input.professionalSummary !== undefined,
  );
export class ProfileError extends Error {
  constructor(
    readonly code:
      | "unauthenticated"
      | "forbidden"
      | "not_found"
      | "revision_conflict"
      | "profile_exists"
      | "onboarding_complete"
      | "section_limit"
      | "invalid_input",
  ) {
    super("Profile request rejected");
  }
}
