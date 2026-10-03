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
export class ProfileError extends Error {
  constructor(
    readonly code:
      | "unauthenticated"
      | "forbidden"
      | "not_found"
      | "revision_conflict"
      | "invalid_input",
  ) {
    super("Profile request rejected");
  }
}
