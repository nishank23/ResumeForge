import { z } from "zod";

export const MAX_CERTIFICATIONS = 50;
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

const fields = {
  name: z.string().trim().min(1).max(200),
  issuer: z.string().trim().min(1).max(200),
  issueDate: date,
  expiryDate: date,
  credentialUrl: urlSchema,
};

function validDates(input: {
  issueDate: string | null;
  expiryDate: string | null;
}) {
  if (input.expiryDate === null) return true;
  if (input.issueDate === null) return false;
  const ordinal = (value: string, end: boolean) => {
    const [year, month] = value.split("-");
    return Number(year) * 12 + (month ? Number(month) : end ? 12 : 1);
  };
  return ordinal(input.expiryDate, true) >= ordinal(input.issueDate, false);
}

export const certificationCreateSchema = z
  .object({
    name: fields.name,
    issuer: fields.issuer,
    issueDate: fields.issueDate.default(null),
    expiryDate: fields.expiryDate.default(null),
    credentialUrl: fields.credentialUrl.default(null),
    expectedRevision: revision.max(2_147_483_646),
  })
  .strict()
  .refine(validDates);

export const certificationUpdateSchema = z
  .object({
    ...fields,
    expectedRevision: revision.max(2_147_483_646),
  })
  .strict()
  .refine(validDates);

export const certificationSchema = z
  .object({
    id: z.string().uuid(),
    ...fields,
  })
  .strict()
  .refine(validDates);

export const certificationListSchema = z
  .object({
    profileId: z.string().uuid(),
    revision,
    entries: z.array(certificationSchema).max(MAX_CERTIFICATIONS),
  })
  .strict();

export const certificationAddedSchema = z
  .object({
    profileId: z.string().uuid(),
    revision,
    entry: certificationSchema,
  })
  .strict();

export type CertificationListDto = z.infer<typeof certificationListSchema>;
export type CertificationAddedDto = z.infer<typeof certificationAddedSchema>;
