import { z } from "zod";

const urlSchema = z
  .string()
  .trim()
  .url()
  .max(500)
  .nullable();

const emailSchema = z
  .string()
  .trim()
  .email()
  .max(200)
  .nullable();

const stringField = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable();

export const contactFields = {
  email: emailSchema,
  phone: stringField(50),
  address: stringField(200),
  linkedinUrl: urlSchema,
  githubUrl: urlSchema,
  portfolioUrl: urlSchema,
};

export const userContactSchema = z
  .object({
    id: z.string().uuid(),
    profileId: z.string().uuid(),
    ...contactFields,
    updatedAt: z.string(),
  })
  .strict();

export type UserContactDto = z.infer<typeof userContactSchema>;

export const userContactUpdateSchema = z
  .object({
    email: contactFields.email.optional(),
    phone: contactFields.phone.optional(),
    address: contactFields.address.optional(),
    linkedinUrl: contactFields.linkedinUrl.optional(),
    githubUrl: contactFields.githubUrl.optional(),
    portfolioUrl: contactFields.portfolioUrl.optional(),
  })
  .strict();

export type UserContactUpdateInput = z.infer<typeof userContactUpdateSchema>;

export const sectionDeleteInputSchema = z
  .object({
    expectedRevision: z.number().int().positive().max(2_147_483_646),
  })
  .strict();

export type SectionDeleteInput = z.infer<typeof sectionDeleteInputSchema>;

export const sectionDeleteResultSchema = z
  .object({
    profileId: z.string().uuid(),
    revision: z.number().int().positive().max(2_147_483_647),
    deletedEntryId: z.string().uuid(),
  })
  .strict();

export type SectionDeleteResultDto = z.infer<typeof sectionDeleteResultSchema>;

export const profileCompleteInputSchema = z
  .object({
    expectedRevision: z.number().int().positive().max(2_147_483_646),
  })
  .strict();

export type ProfileCompleteInput = z.infer<typeof profileCompleteInputSchema>;

export const profileCompleteResultSchema = z
  .object({
    id: z.string().uuid(),
    onboardingCompletedAt: z.string(),
    revision: z.number().int().positive().max(2_147_483_647),
  })
  .strict();

export type ProfileCompleteResultDto = z.infer<typeof profileCompleteResultSchema>;
