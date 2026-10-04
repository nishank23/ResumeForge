import { z } from "zod";

export const MAX_PROJECTS = 50;
const revision = z.number().int().positive().max(2_147_483_647);
const date = z
  .string()
  .regex(/^[1-9]\d{3}(?:-(?:0[1-9]|1[0-2]))?$/)
  .nullable();
const urlSchema = z
  .string()
  .trim()
  .url()
  .max(500)
  .nullable();
const technologiesSchema = z
  .array(z.string().trim().min(1).max(50))
  .max(30);

const fields = {
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(2_000),
  url: urlSchema,
  technologies: technologiesSchema,
  startDate: date,
  endDate: date,
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

export const projectCreateSchema = z
  .object({
    name: fields.name,
    description: fields.description,
    url: fields.url.default(null),
    technologies: fields.technologies.default([]),
    startDate: fields.startDate.default(null),
    endDate: fields.endDate.default(null),
    expectedRevision: revision.max(2_147_483_646),
  })
  .strict()
  .refine(validDates);

export const projectUpdateSchema = z
  .object({
    ...fields,
    expectedRevision: revision.max(2_147_483_646),
  })
  .strict()
  .refine(validDates);

export const projectSchema = z
  .object({
    id: z.string().uuid(),
    ...fields,
  })
  .strict()
  .refine(validDates);

export const projectListSchema = z
  .object({
    profileId: z.string().uuid(),
    revision,
    entries: z.array(projectSchema).max(MAX_PROJECTS),
  })
  .strict();

export const projectAddedSchema = z
  .object({
    profileId: z.string().uuid(),
    revision,
    entry: projectSchema,
  })
  .strict();

export type ProjectListDto = z.infer<typeof projectListSchema>;
export type ProjectAddedDto = z.infer<typeof projectAddedSchema>;
