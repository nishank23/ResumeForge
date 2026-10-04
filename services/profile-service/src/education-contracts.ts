import { z } from "zod";

export const MAX_EDUCATIONS = 50;
const revision = z.number().int().positive().max(2_147_483_647);
const date = z
  .string()
  .regex(/^[1-9]\d{3}(?:-(?:0[1-9]|1[0-2]))?$/)
  .nullable();
const fields = {
  institution: z.string().trim().min(1).max(200),
  degree: z.string().trim().min(1).max(200),
  fieldOfStudy: z.string().trim().min(1).max(200),
  startDate: date,
  endDate: date,
  gpa: z.string().trim().max(50).nullable(),
  description: z.string().trim().max(1_000).nullable(),
};
function validDates(input: {
  startDate: string | null;
  endDate: string | null;
}) {
  if (input.endDate === null) return true;
  if (input.startDate === null) return false;
  const ordinal = (value: string, end: boolean) => {
    const [year, month] = value.split("-");
    return Number(year) * 12 + (month ? Number(month) : end ? 12 : 1);
  };
  return ordinal(input.endDate, true) >= ordinal(input.startDate, false);
}
export const educationCreateSchema = z
  .object({
    institution: fields.institution,
    degree: fields.degree,
    fieldOfStudy: fields.fieldOfStudy,
    startDate: fields.startDate.default(null),
    endDate: fields.endDate.default(null),
    gpa: fields.gpa.default(null),
    description: fields.description.default(null),
    expectedRevision: revision.max(2_147_483_646),
  })
  .strict()
  .refine(validDates);
export const educationSchema = z
  .object({
    id: z.string().uuid(),
    ...fields,
    sortOrder: z.number().int().nonnegative().max(2_147_483_647),
  })
  .strict()
  .refine(validDates);
export const educationListSchema = z
  .object({
    profileId: z.string().uuid(),
    revision,
    entries: z.array(educationSchema).max(MAX_EDUCATIONS),
  })
  .strict();
export const educationAddedSchema = z
  .object({
    profileId: z.string().uuid(),
    revision,
    entry: educationSchema,
  })
  .strict();
export type EducationListDto = z.infer<typeof educationListSchema>;
export type EducationAddedDto = z.infer<typeof educationAddedSchema>;
