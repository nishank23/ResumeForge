import { z } from "zod";

export const MAX_SKILLS = 100;
const revision = z.number().int().positive().max(2_147_483_647);

const fields = {
  name: z.string().trim().min(1).max(100),
  category: z.string().trim().min(1).max(100),
  proficiency: z.string().trim().min(1).max(50),
};

export const skillCreateSchema = z
  .object({
    name: fields.name,
    category: fields.category.default("General"),
    proficiency: fields.proficiency.default("intermediate"),
    expectedRevision: revision.max(2_147_483_646),
  })
  .strict();

export const skillUpdateSchema = z
  .object({
    name: fields.name,
    category: fields.category,
    proficiency: fields.proficiency,
    expectedRevision: revision.max(2_147_483_646),
  })
  .strict();

export const skillSchema = z
  .object({
    id: z.string().uuid(),
    name: fields.name,
    category: fields.category,
    proficiency: fields.proficiency,
  })
  .strict();

export const skillListSchema = z
  .object({
    profileId: z.string().uuid(),
    revision,
    entries: z.array(skillSchema).max(MAX_SKILLS),
  })
  .strict();

export const skillAddedSchema = z
  .object({
    profileId: z.string().uuid(),
    revision,
    entry: skillSchema,
  })
  .strict();

export type SkillListDto = z.infer<typeof skillListSchema>;
export type SkillAddedDto = z.infer<typeof skillAddedSchema>;
