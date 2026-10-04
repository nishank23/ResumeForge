import { z } from "zod";

export const MAX_EXPERIENCES = 50;
const revision = z.number().int().positive().max(2_147_483_647);
const date = z
  .string()
  .regex(/^[1-9]\d{3}(?:-(?:0[1-9]|1[0-2]))?$/)
  .nullable();
const fields = {
  company: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(200),
  location: z.string().trim().max(200).nullable(),
  startDate: date,
  endDate: date,
  isCurrent: z.boolean(),
  bulletPoints: z.array(z.string().trim().min(1).max(1_000)).max(20),
};
function validDates(input: {
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
}) {
  if (input.isCurrent && input.endDate !== null) return false;
  if (input.endDate === null) return true;
  if (input.startDate === null) return false;
  const ordinal = (value: string, end: boolean) => {
    const [year, month] = value.split("-");
    return Number(year) * 12 + (month ? Number(month) : end ? 12 : 1);
  };
  return ordinal(input.endDate, true) >= ordinal(input.startDate, false);
}
export const experienceCreateSchema = z
  .object({
    company: fields.company,
    title: fields.title,
    location: fields.location.default(null),
    startDate: fields.startDate.default(null),
    endDate: fields.endDate.default(null),
    isCurrent: fields.isCurrent.default(false),
    bulletPoints: fields.bulletPoints.default([]),
    expectedRevision: revision.max(2_147_483_646),
  })
  .strict()
  .refine(validDates);
export const experienceUpdateSchema = z
  .object({
    ...fields,
    expectedRevision: revision.max(2_147_483_646),
  })
  .strict()
  .refine(validDates);
export const experienceSchema = z
  .object({
    id: z.string().uuid(),
    ...fields,
    sortOrder: z.number().int().nonnegative().max(2_147_483_647),
  })
  .strict()
  .refine(validDates);
export const experienceListSchema = z
  .object({
    profileId: z.string().uuid(),
    revision,
    entries: z.array(experienceSchema).max(MAX_EXPERIENCES),
  })
  .strict();
export const experienceAddedSchema = z
  .object({
    profileId: z.string().uuid(),
    revision,
    entry: experienceSchema,
  })
  .strict();
export type ExperienceListDto = z.infer<typeof experienceListSchema>;
export type ExperienceAddedDto = z.infer<typeof experienceAddedSchema>;
