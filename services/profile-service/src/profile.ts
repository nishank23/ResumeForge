import { randomUUID } from "node:crypto";
import { z } from "zod";
import { authorizePersonalProfileAction } from "@resume-forge/access-policy";
import {
  resolvedActorSchema,
  type ResolvedActor,
} from "@resume-forge/access-policy/server";
import {
  validateAuditEventIntent,
  type AuditEventIntent,
} from "@resume-forge/audit-contracts";
import {
  withPersonalAuditTransaction,
  type createDatabaseClient,
} from "@resume-forge/prisma-client";
import type { ProfessionalProfileDto } from "@resume-forge/shared-types";
import {
  ProfileError,
  profileCreateSchema,
  profileDraftSchema,
  profileUpdateSchema,
  professionalProfileSchema,
} from "./contracts.js";
import {
  MAX_EXPERIENCES,
  experienceCreateSchema,
  experienceListSchema,
  experienceAddedSchema,
  experienceUpdateSchema,
  type ExperienceListDto,
  type ExperienceAddedDto,
} from "./experience-contracts.js";
import {
  MAX_EDUCATIONS,
  educationCreateSchema,
  educationListSchema,
  educationAddedSchema,
  educationUpdateSchema,
  type EducationListDto,
  type EducationAddedDto,
} from "./education-contracts.js";
import {
  MAX_SKILLS,
  skillCreateSchema,
  skillListSchema,
  skillAddedSchema,
  skillUpdateSchema,
  type SkillListDto,
  type SkillAddedDto,
} from "./skill-contracts.js";
import {
  MAX_PROJECTS,
  projectCreateSchema,
  projectListSchema,
  projectAddedSchema,
  projectUpdateSchema,
  type ProjectListDto,
  type ProjectAddedDto,
} from "./project-contracts.js";
import {
  MAX_CERTIFICATIONS,
  certificationCreateSchema,
  certificationListSchema,
  certificationAddedSchema,
  certificationUpdateSchema,
  type CertificationListDto,
  type CertificationAddedDto,
} from "./certification-contracts.js";
import {
  userContactSchema,
  userContactUpdateSchema,
  sectionDeleteInputSchema,
  sectionDeleteResultSchema,
  profileCompleteInputSchema,
  profileCompleteResultSchema,
  type UserContactDto,
  type SectionDeleteResultDto,
  type ProfileCompleteResultDto,
} from "./contact-contracts.js";

type Database = ReturnType<typeof createDatabaseClient>;
type Context = {
  actor: ResolvedActor;
  selectedWorkspaceId?: string;
  correlationId: string;
};
const projection = {
  id: true,
  fullName: true,
  location: true,
  professionalSummary: true,
  revision: true,
} as const;
const experienceProjection = {
  id: true,
  company: true,
  title: true,
  location: true,
  startDate: true,
  endDate: true,
  isCurrent: true,
  bulletPoints: true,
  sortOrder: true,
} as const;
const educationProjection = {
  id: true,
  institution: true,
  degree: true,
  fieldOfStudy: true,
  startDate: true,
  endDate: true,
  gpa: true,
  description: true,
  sortOrder: true,
} as const;
const skillProjection = {
  id: true,
  name: true,
  category: true,
  proficiency: true,
} as const;
const projectProjection = {
  id: true,
  name: true,
  description: true,
  url: true,
  technologies: true,
  startDate: true,
  endDate: true,
} as const;
const certificationProjection = {
  id: true,
  name: true,
  issuer: true,
  issueDate: true,
  expiryDate: true,
  credentialUrl: true,
} as const;

/** Server composition supplies a freshly verified actor; context from request bodies is never accepted. */
export function createProfileUseCases(db: Database, now = Date.now) {
  function assertContext(context: Context) {
    if (
      !resolvedActorSchema.safeParse(context.actor).success ||
      context.actor.expiresAt <= now()
    )
      throw new ProfileError("unauthenticated");
    if (!z.string().uuid().safeParse(context.correlationId).success)
      throw new ProfileError("invalid_input");
  }
  function event(
    context: Context,
    action: AuditEventIntent["action"],
    resourceId: string,
  ): AuditEventIntent {
    return {
      eventId: randomUUID(),
      action,
      actorUserId: context.actor.userId,
      targetUserId: context.actor.userId,
      workspaceType: "individual",
      workspaceId: context.actor.personalWorkspaceId,
      resourceType: "profile",
      resourceId,
      outcome: "succeeded",
      occurredAt: new Date(now()).toISOString(),
      correlationId: context.correlationId,
      metadata: {},
    };
  }
  async function authorizeWorkspace(
    context: Context,
    permission: "profile.create" | "profile.read" | "profile.update",
  ) {
    assertContext(context);
    const workspace = await db.workspace.findFirst({
      where: {
        id: context.actor.personalWorkspaceId,
        type: "individual",
        personalOwnerUserId: context.actor.userId,
      },
      select: { id: true, type: true, personalOwnerUserId: true },
    });
    if (!workspace?.personalOwnerUserId) throw new ProfileError("forbidden");
    const decision = authorizePersonalProfileAction({
      permission,
      actorUserId: context.actor.userId,
      workspace: {
        ...workspace,
        personalOwnerUserId: workspace.personalOwnerUserId,
      },
      clientSelectedWorkspaceId: context.selectedWorkspaceId,
    });
    if (!decision.allowed) {
      // Record the denial in the actor's authoritative workspace; never copy a forged selector.
      const intent = validateAuditEventIntent({
        ...event(context, "authorization.denied", workspace.id),
        resourceType: "workspace",
        outcome: "denied",
        metadata: { permission, reasonCode: decision.code },
      });
      if (!intent.success) throw new Error("Profile audit unavailable");
      await db.$transaction(async (tx) => {
        assertContext(context);
        const owned = await tx.workspace.findFirst({
          where: {
            id: workspace.id,
            type: "individual",
            personalOwnerUserId: context.actor.userId,
          },
          select: { id: true },
        });
        if (!owned) throw new ProfileError("forbidden");
        await tx.auditOutbox.createMany({
          data: {
            eventId: intent.data.eventId,
            payload: { ...intent.data, metadata: { ...intent.data.metadata } },
          },
        });
      });
      throw new ProfileError("forbidden");
    }
    return { ...workspace, personalOwnerUserId: workspace.personalOwnerUserId };
  }
  async function authorize(
    context: Context,
    permission: "profile.read" | "profile.update",
  ) {
    const workspace = await authorizeWorkspace(context, permission);
    // Master profiles are user-owned (not workspace copies); scope has been verified above.
    const profile = await db.userProfile.findFirst({
      where: { userId: context.actor.userId },
      select: { id: true, userId: true },
    });
    if (!profile) throw new ProfileError("not_found");
    const resource = authorizePersonalProfileAction({
      permission,
      actorUserId: context.actor.userId,
      workspace: {
        ...workspace,
        personalOwnerUserId: workspace.personalOwnerUserId,
      },
      resource: {
        id: profile.id,
        ownerUserId: profile.userId,
        workspaceId: workspace.id,
      },
    });
    if (!resource.allowed) throw new ProfileError("forbidden");
    return profile.id;
  }
  async function execute(
    context: Context,
    mode: "read" | "update" | "draft",
    input?: unknown,
  ): Promise<ProfessionalProfileDto> {
    const writing = mode !== "read";
    const parsed = writing
      ? (mode === "draft" ? profileDraftSchema : profileUpdateSchema).safeParse(
          input,
        )
      : undefined;
    assertContext(context);
    if (parsed && !parsed.success) throw new ProfileError("invalid_input");
    const id = await authorize(
      context,
      writing ? "profile.update" : "profile.read",
    );
    const intent = event(
      context,
      writing ? "profile.updated" : "profile.viewed",
      id,
    );
    return withPersonalAuditTransaction(
      db,
      context.actor.userId,
      mode === "draft"
        ? {
            ...intent,
            metadata: { permission: "profile.update", status: "draft_saved" },
          }
        : intent,
      async (tx) => {
        assertContext(context);
        const where = { id, userId: context.actor.userId };
        if (parsed?.success) {
          const { expectedRevision, ...fields } = parsed.data;
          const updated = await tx.userProfile.updateMany({
            where: {
              ...where,
              revision: expectedRevision,
              // This predicate also guards a completion racing a draft save.
              ...(mode === "draft" ? { onboardingCompletedAt: null } : {}),
            },
            data: { ...fields, revision: { increment: 1 } },
          });
          if (updated.count !== 1) {
            if (mode === "draft") {
              const state = await tx.userProfile.findFirst({
                where,
                select: { onboardingCompletedAt: true },
              });
              if (!state) throw new ProfileError("not_found");
              if (state.onboardingCompletedAt !== null)
                throw new ProfileError("onboarding_complete");
            }
            throw new ProfileError("revision_conflict");
          }
        }
        const profile = await tx.userProfile.findFirst({
          where,
          select: projection,
        });
        if (!profile) throw new ProfileError("not_found");
        assertContext(context);
        // No ORM model, contact relation, embedding, grant or auth identity is serialized.
        return professionalProfileSchema.parse(profile);
      },
    );
  }
  return {
    listExperience: async (context: Context): Promise<ExperienceListDto> => {
      assertContext(context);
      const id = await authorize(context, "profile.read");
      return withPersonalAuditTransaction(
        db,
        context.actor.userId,
        {
          ...event(context, "profile.viewed", id),
          metadata: { permission: "profile.read", status: "experience_read" },
        },
        async (tx) => {
          assertContext(context);
          // Every application section write locks/increments this same parent first.
          const [parent] = await tx.$queryRaw<
            { id: string; revision: number }[]
          >`
            SELECT "id", "revision" FROM "UserProfile"
            WHERE "id" = ${id}::uuid AND "userId" = ${context.actor.userId}::uuid
            FOR SHARE`;
          if (!parent) throw new ProfileError("not_found");
          const entries = await tx.experience.findMany({
            where: { profileId: id, profile: { userId: context.actor.userId } },
            select: experienceProjection,
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            take: MAX_EXPERIENCES + 1,
          });
          assertContext(context);
          return experienceListSchema.parse({
            profileId: parent.id,
            revision: parent.revision,
            entries: entries.map((entry) => ({
              ...entry,
              bulletPoints: entry.bulletPoints ?? [],
            })),
          });
        },
      );
    },
    addExperience: async (
      context: Context,
      input: unknown,
    ): Promise<ExperienceAddedDto> => {
      assertContext(context);
      const parsed = experienceCreateSchema.safeParse(input);
      if (!parsed.success) throw new ProfileError("invalid_input");
      const profileId = await authorize(context, "profile.update");
      return withPersonalAuditTransaction(
        db,
        context.actor.userId,
        {
          ...event(context, "profile.updated", profileId),
          metadata: {
            permission: "profile.update",
            status: "experience_added",
          },
        },
        async (tx) => {
          assertContext(context);
          const { expectedRevision, ...fields } = parsed.data;
          const updated = await tx.userProfile.updateMany({
            where: {
              id: profileId,
              userId: context.actor.userId,
              revision: expectedRevision,
            },
            data: { revision: { increment: 1 } },
          });
          if (updated.count !== 1) throw new ProfileError("revision_conflict");
          const where = {
            profileId,
            profile: { userId: context.actor.userId },
          };
          if ((await tx.experience.count({ where })) >= MAX_EXPERIENCES)
            throw new ProfileError("section_limit");
          const previous = await tx.experience.findFirst({
            where,
            orderBy: { sortOrder: "desc" },
            select: { sortOrder: true },
          });
          if (
            previous &&
            (previous.sortOrder < 0 || previous.sortOrder >= 2_147_483_647)
          )
            throw new ProfileError("section_limit");
          const entry = await tx.experience.create({
            data: {
              id: randomUUID(),
              profileId,
              ...fields,
              sortOrder: previous ? previous.sortOrder + 1 : 0,
            },
            select: experienceProjection,
          });
          assertContext(context);
          return experienceAddedSchema.parse({
            profileId,
            revision: expectedRevision + 1,
            entry,
          });
        },
      );
    },
    updateExperience: async (
      context: Context,
      entryId: string,
      input: unknown,
    ): Promise<ExperienceAddedDto> => {
      assertContext(context);
      const parsed = experienceUpdateSchema.safeParse(input);
      if (!z.string().uuid().safeParse(entryId).success || !parsed.success)
        throw new ProfileError("invalid_input");
      const profileId = await authorize(context, "profile.update");
      return withPersonalAuditTransaction(
        db,
        context.actor.userId,
        {
          ...event(context, "profile.updated", profileId),
          metadata: {
            permission: "profile.update",
            status: "experience_updated",
          },
        },
        async (tx) => {
          assertContext(context);
          const { expectedRevision, ...fields } = parsed.data;
          // Lock the same parent as every other professional write before the child.
          const parent = await tx.userProfile.updateMany({
            where: {
              id: profileId,
              userId: context.actor.userId,
              revision: expectedRevision,
            },
            data: { revision: { increment: 1 } },
          });
          if (parent.count !== 1) throw new ProfileError("revision_conflict");
          const where = {
            id: entryId,
            profileId,
            profile: { userId: context.actor.userId },
          };
          const updated = await tx.experience.updateMany({
            where,
            data: fields,
          });
          // Throwing also rolls back the parent revision for missing/foreign IDs.
          if (updated.count !== 1) throw new ProfileError("not_found");
          const entry = await tx.experience.findFirst({
            where,
            select: experienceProjection,
          });
          if (!entry) throw new ProfileError("not_found");
          assertContext(context);
          return experienceAddedSchema.parse({
            profileId,
            revision: expectedRevision + 1,
            entry,
          });
        },
      );
    },
    listEducation: async (context: Context): Promise<EducationListDto> => {
      assertContext(context);
      const id = await authorize(context, "profile.read");
      return withPersonalAuditTransaction(
        db,
        context.actor.userId,
        {
          ...event(context, "profile.viewed", id),
          metadata: { permission: "profile.read", status: "education_read" },
        },
        async (tx) => {
          assertContext(context);
          // Every application section write locks/increments this same parent first.
          const [parent] = await tx.$queryRaw<
            { id: string; revision: number }[]
          >`
            SELECT "id", "revision" FROM "UserProfile"
            WHERE "id" = ${id}::uuid AND "userId" = ${context.actor.userId}::uuid
            FOR SHARE`;
          if (!parent) throw new ProfileError("not_found");
          const entries = await tx.education.findMany({
            where: { profileId: id, profile: { userId: context.actor.userId } },
            select: educationProjection,
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            take: MAX_EDUCATIONS + 1,
          });
          assertContext(context);
          return educationListSchema.parse({
            profileId: parent.id,
            revision: parent.revision,
            entries,
          });
        },
      );
    },
    addEducation: async (
      context: Context,
      input: unknown,
    ): Promise<EducationAddedDto> => {
      assertContext(context);
      const parsed = educationCreateSchema.safeParse(input);
      if (!parsed.success) throw new ProfileError("invalid_input");
      const profileId = await authorize(context, "profile.update");
      return withPersonalAuditTransaction(
        db,
        context.actor.userId,
        {
          ...event(context, "profile.updated", profileId),
          metadata: {
            permission: "profile.update",
            status: "education_added",
          },
        },
        async (tx) => {
          assertContext(context);
          const { expectedRevision, ...fields } = parsed.data;
          const updated = await tx.userProfile.updateMany({
            where: {
              id: profileId,
              userId: context.actor.userId,
              revision: expectedRevision,
            },
            data: { revision: { increment: 1 } },
          });
          if (updated.count !== 1) throw new ProfileError("revision_conflict");
          const where = {
            profileId,
            profile: { userId: context.actor.userId },
          };
          if ((await tx.education.count({ where })) >= MAX_EDUCATIONS)
            throw new ProfileError("section_limit");
          const previous = await tx.education.findFirst({
            where,
            orderBy: { sortOrder: "desc" },
            select: { sortOrder: true },
          });
          if (
            previous &&
            (previous.sortOrder < 0 || previous.sortOrder >= 2_147_483_647)
          )
            throw new ProfileError("section_limit");
          const entry = await tx.education.create({
            data: {
              id: randomUUID(),
              profileId,
              ...fields,
              sortOrder: previous ? previous.sortOrder + 1 : 0,
            },
            select: educationProjection,
          });
          assertContext(context);
          return educationAddedSchema.parse({
            profileId,
            revision: expectedRevision + 1,
            entry,
          });
        },
      );
    },
    updateEducation: async (
      context: Context,
      entryId: string,
      input: unknown,
    ): Promise<EducationAddedDto> => {
      assertContext(context);
      const parsed = educationUpdateSchema.safeParse(input);
      if (!z.string().uuid().safeParse(entryId).success || !parsed.success)
        throw new ProfileError("invalid_input");
      const profileId = await authorize(context, "profile.update");
      return withPersonalAuditTransaction(
        db,
        context.actor.userId,
        {
          ...event(context, "profile.updated", profileId),
          metadata: {
            permission: "profile.update",
            status: "education_updated",
          },
        },
        async (tx) => {
          assertContext(context);
          const { expectedRevision, ...fields } = parsed.data;
          // Lock the same parent as every other professional write before the child.
          const parent = await tx.userProfile.updateMany({
            where: {
              id: profileId,
              userId: context.actor.userId,
              revision: expectedRevision,
            },
            data: { revision: { increment: 1 } },
          });
          if (parent.count !== 1) throw new ProfileError("revision_conflict");
          const where = {
            id: entryId,
            profileId,
            profile: { userId: context.actor.userId },
          };
          const updated = await tx.education.updateMany({
            where,
            data: fields,
          });
          // Throwing also rolls back the parent revision for missing/foreign IDs.
          if (updated.count !== 1) throw new ProfileError("not_found");
          const entry = await tx.education.findFirst({
            where,
            select: educationProjection,
          });
          if (!entry) throw new ProfileError("not_found");
          assertContext(context);
          return educationAddedSchema.parse({
            profileId,
            revision: expectedRevision + 1,
            entry,
          });
        },
      );
    },
    create: async (
      context: Context,
      input: unknown,
    ): Promise<ProfessionalProfileDto> => {
      assertContext(context);
      const parsed = profileCreateSchema.safeParse(input);
      if (!parsed.success) throw new ProfileError("invalid_input");
      await authorizeWorkspace(context, "profile.create");
      const id = randomUUID();
      return withPersonalAuditTransaction(
        db,
        context.actor.userId,
        {
          ...event(context, "profile.updated", id),
          metadata: { permission: "profile.create", status: "initialized" },
        },
        async (tx) => {
          assertContext(context);
          // The unique userId constraint elects one winner without overwriting an existing profile.
          const created = await tx.userProfile.createMany({
            data: { id, userId: context.actor.userId, ...parsed.data },
            skipDuplicates: true,
          });
          if (created.count !== 1) throw new ProfileError("profile_exists");
          const profile = await tx.userProfile.findFirst({
            where: { id, userId: context.actor.userId },
            select: projection,
          });
          if (!profile) throw new ProfileError("not_found");
          assertContext(context);
          return professionalProfileSchema.parse(profile);
        },
      );
    },
    listSkills: async (context: Context): Promise<SkillListDto> => {
      assertContext(context);
      const id = await authorize(context, "profile.read");
      return withPersonalAuditTransaction(
        db,
        context.actor.userId,
        {
          ...event(context, "profile.viewed", id),
          metadata: { permission: "profile.read", status: "skills_read" },
        },
        async (tx) => {
          assertContext(context);
          const [parent] = await tx.$queryRaw<
            { id: string; revision: number }[]
          >`
            SELECT "id", "revision" FROM "UserProfile"
            WHERE "id" = ${id}::uuid AND "userId" = ${context.actor.userId}::uuid
            FOR SHARE`;
          if (!parent) throw new ProfileError("not_found");
          const entries = await tx.skill.findMany({
            where: { profileId: id, profile: { userId: context.actor.userId } },
            select: skillProjection,
            orderBy: [{ category: "asc" }, { name: "asc" }, { id: "asc" }],
            take: MAX_SKILLS + 1,
          });
          assertContext(context);
          return skillListSchema.parse({
            profileId: id,
            revision: parent.revision,
            entries,
          });
        },
      );
    },
    addSkill: async (
      context: Context,
      input: unknown,
    ): Promise<SkillAddedDto> => {
      assertContext(context);
      const parsed = skillCreateSchema.safeParse(input);
      if (!parsed.success) throw new ProfileError("invalid_input");
      const profileId = await authorize(context, "profile.update");
      return withPersonalAuditTransaction(
        db,
        context.actor.userId,
        {
          ...event(context, "profile.updated", profileId),
          metadata: {
            permission: "profile.update",
            status: "skill_added",
          },
        },
        async (tx) => {
          assertContext(context);
          const { expectedRevision, ...fields } = parsed.data;
          const updated = await tx.userProfile.updateMany({
            where: {
              id: profileId,
              userId: context.actor.userId,
              revision: expectedRevision,
            },
            data: { revision: { increment: 1 } },
          });
          if (updated.count !== 1) throw new ProfileError("revision_conflict");
          const where = {
            profileId,
            profile: { userId: context.actor.userId },
          };
          if ((await tx.skill.count({ where })) >= MAX_SKILLS)
            throw new ProfileError("section_limit");
          const entry = await tx.skill.create({
            data: {
              id: randomUUID(),
              profileId,
              ...fields,
            },
            select: skillProjection,
          });
          assertContext(context);
          return skillAddedSchema.parse({
            profileId,
            revision: expectedRevision + 1,
            entry,
          });
        },
      );
    },
    updateSkill: async (
      context: Context,
      entryId: string,
      input: unknown,
    ): Promise<SkillAddedDto> => {
      assertContext(context);
      const parsed = skillUpdateSchema.safeParse(input);
      if (!z.string().uuid().safeParse(entryId).success || !parsed.success)
        throw new ProfileError("invalid_input");
      const profileId = await authorize(context, "profile.update");
      return withPersonalAuditTransaction(
        db,
        context.actor.userId,
        {
          ...event(context, "profile.updated", profileId),
          metadata: {
            permission: "profile.update",
            status: "skill_updated",
          },
        },
        async (tx) => {
          assertContext(context);
          const { expectedRevision, ...fields } = parsed.data;
          const parent = await tx.userProfile.updateMany({
            where: {
              id: profileId,
              userId: context.actor.userId,
              revision: expectedRevision,
            },
            data: { revision: { increment: 1 } },
          });
          if (parent.count !== 1) throw new ProfileError("revision_conflict");
          const where = {
            id: entryId,
            profileId,
            profile: { userId: context.actor.userId },
          };
          const updated = await tx.skill.updateMany({
            where,
            data: fields,
          });
          if (updated.count !== 1) throw new ProfileError("not_found");
          const entry = await tx.skill.findFirst({
            where,
            select: skillProjection,
          });
          if (!entry) throw new ProfileError("not_found");
          assertContext(context);
          return skillAddedSchema.parse({
            profileId,
            revision: expectedRevision + 1,
            entry,
          });
        },
      );
    },
    listProjects: async (context: Context): Promise<ProjectListDto> => {
      assertContext(context);
      const id = await authorize(context, "profile.read");
      return withPersonalAuditTransaction(
        db,
        context.actor.userId,
        {
          ...event(context, "profile.viewed", id),
          metadata: { permission: "profile.read", status: "projects_read" },
        },
        async (tx) => {
          assertContext(context);
          const [parent] = await tx.$queryRaw<
            { id: string; revision: number }[]
          >`
            SELECT "id", "revision" FROM "UserProfile"
            WHERE "id" = ${id}::uuid AND "userId" = ${context.actor.userId}::uuid
            FOR SHARE`;
          if (!parent) throw new ProfileError("not_found");
          const entries = await tx.userProject.findMany({
            where: { profileId: id, profile: { userId: context.actor.userId } },
            select: projectProjection,
            orderBy: [{ startDate: "desc" }, { name: "asc" }, { id: "asc" }],
            take: MAX_PROJECTS + 1,
          });
          assertContext(context);
          return projectListSchema.parse({
            profileId: id,
            revision: parent.revision,
            entries: entries.map((entry) => ({
              ...entry,
              technologies: Array.isArray(entry.technologies)
                ? entry.technologies
                : [],
            })),
          });
        },
      );
    },
    addProject: async (
      context: Context,
      input: unknown,
    ): Promise<ProjectAddedDto> => {
      assertContext(context);
      const parsed = projectCreateSchema.safeParse(input);
      if (!parsed.success) throw new ProfileError("invalid_input");
      const profileId = await authorize(context, "profile.update");
      return withPersonalAuditTransaction(
        db,
        context.actor.userId,
        {
          ...event(context, "profile.updated", profileId),
          metadata: {
            permission: "profile.update",
            status: "project_added",
          },
        },
        async (tx) => {
          assertContext(context);
          const { expectedRevision, ...fields } = parsed.data;
          const updated = await tx.userProfile.updateMany({
            where: {
              id: profileId,
              userId: context.actor.userId,
              revision: expectedRevision,
            },
            data: { revision: { increment: 1 } },
          });
          if (updated.count !== 1) throw new ProfileError("revision_conflict");
          const where = {
            profileId,
            profile: { userId: context.actor.userId },
          };
          if ((await tx.userProject.count({ where })) >= MAX_PROJECTS)
            throw new ProfileError("section_limit");
          const entry = await tx.userProject.create({
            data: {
              id: randomUUID(),
              profileId,
              ...fields,
              technologies: fields.technologies,
            },
            select: projectProjection,
          });
          assertContext(context);
          return projectAddedSchema.parse({
            profileId,
            revision: expectedRevision + 1,
            entry: {
              ...entry,
              technologies: Array.isArray(entry.technologies)
                ? entry.technologies
                : [],
            },
          });
        },
      );
    },
    updateProject: async (
      context: Context,
      entryId: string,
      input: unknown,
    ): Promise<ProjectAddedDto> => {
      assertContext(context);
      const parsed = projectUpdateSchema.safeParse(input);
      if (!z.string().uuid().safeParse(entryId).success || !parsed.success)
        throw new ProfileError("invalid_input");
      const profileId = await authorize(context, "profile.update");
      return withPersonalAuditTransaction(
        db,
        context.actor.userId,
        {
          ...event(context, "profile.updated", profileId),
          metadata: {
            permission: "profile.update",
            status: "project_updated",
          },
        },
        async (tx) => {
          assertContext(context);
          const { expectedRevision, ...fields } = parsed.data;
          const parent = await tx.userProfile.updateMany({
            where: {
              id: profileId,
              userId: context.actor.userId,
              revision: expectedRevision,
            },
            data: { revision: { increment: 1 } },
          });
          if (parent.count !== 1) throw new ProfileError("revision_conflict");
          const where = {
            id: entryId,
            profileId,
            profile: { userId: context.actor.userId },
          };
          const updated = await tx.userProject.updateMany({
            where,
            data: {
              ...fields,
              technologies: fields.technologies,
            },
          });
          if (updated.count !== 1) throw new ProfileError("not_found");
          const entry = await tx.userProject.findFirst({
            where,
            select: projectProjection,
          });
          if (!entry) throw new ProfileError("not_found");
          assertContext(context);
          return projectAddedSchema.parse({
            profileId,
            revision: expectedRevision + 1,
            entry: {
              ...entry,
              technologies: Array.isArray(entry.technologies)
                ? entry.technologies
                : [],
            },
          });
        },
      );
    },
    listCertifications: async (
      context: Context,
    ): Promise<CertificationListDto> => {
      assertContext(context);
      const id = await authorize(context, "profile.read");
      return withPersonalAuditTransaction(
        db,
        context.actor.userId,
        {
          ...event(context, "profile.viewed", id),
          metadata: {
            permission: "profile.read",
            status: "certifications_read",
          },
        },
        async (tx) => {
          assertContext(context);
          const [parent] = await tx.$queryRaw<
            { id: string; revision: number }[]
          >`
            SELECT "id", "revision" FROM "UserProfile"
            WHERE "id" = ${id}::uuid AND "userId" = ${context.actor.userId}::uuid
            FOR SHARE`;
          if (!parent) throw new ProfileError("not_found");
          const entries = await tx.certification.findMany({
            where: { profileId: id, profile: { userId: context.actor.userId } },
            select: certificationProjection,
            orderBy: [{ issueDate: "desc" }, { name: "asc" }, { id: "asc" }],
            take: MAX_CERTIFICATIONS + 1,
          });
          assertContext(context);
          return certificationListSchema.parse({
            profileId: id,
            revision: parent.revision,
            entries,
          });
        },
      );
    },
    addCertification: async (
      context: Context,
      input: unknown,
    ): Promise<CertificationAddedDto> => {
      assertContext(context);
      const parsed = certificationCreateSchema.safeParse(input);
      if (!parsed.success) throw new ProfileError("invalid_input");
      const profileId = await authorize(context, "profile.update");
      return withPersonalAuditTransaction(
        db,
        context.actor.userId,
        {
          ...event(context, "profile.updated", profileId),
          metadata: {
            permission: "profile.update",
            status: "certification_added",
          },
        },
        async (tx) => {
          assertContext(context);
          const { expectedRevision, ...fields } = parsed.data;
          const updated = await tx.userProfile.updateMany({
            where: {
              id: profileId,
              userId: context.actor.userId,
              revision: expectedRevision,
            },
            data: { revision: { increment: 1 } },
          });
          if (updated.count !== 1) throw new ProfileError("revision_conflict");
          const where = {
            profileId,
            profile: { userId: context.actor.userId },
          };
          if ((await tx.certification.count({ where })) >= MAX_CERTIFICATIONS)
            throw new ProfileError("section_limit");
          const entry = await tx.certification.create({
            data: {
              id: randomUUID(),
              profileId,
              ...fields,
            },
            select: certificationProjection,
          });
          assertContext(context);
          return certificationAddedSchema.parse({
            profileId,
            revision: expectedRevision + 1,
            entry,
          });
        },
      );
    },
    updateCertification: async (
      context: Context,
      entryId: string,
      input: unknown,
    ): Promise<CertificationAddedDto> => {
      assertContext(context);
      const parsed = certificationUpdateSchema.safeParse(input);
      if (!z.string().uuid().safeParse(entryId).success || !parsed.success)
        throw new ProfileError("invalid_input");
      const profileId = await authorize(context, "profile.update");
      return withPersonalAuditTransaction(
        db,
        context.actor.userId,
        {
          ...event(context, "profile.updated", profileId),
          metadata: {
            permission: "profile.update",
            status: "certification_updated",
          },
        },
        async (tx) => {
          assertContext(context);
          const { expectedRevision, ...fields } = parsed.data;
          const parent = await tx.userProfile.updateMany({
            where: {
              id: profileId,
              userId: context.actor.userId,
              revision: expectedRevision,
            },
            data: { revision: { increment: 1 } },
          });
          if (parent.count !== 1) throw new ProfileError("revision_conflict");
          const where = {
            id: entryId,
            profileId,
            profile: { userId: context.actor.userId },
          };
          const updated = await tx.certification.updateMany({
            where,
            data: fields,
          });
          if (updated.count !== 1) throw new ProfileError("not_found");
          const entry = await tx.certification.findFirst({
            where,
            select: certificationProjection,
          });
          if (!entry) throw new ProfileError("not_found");
          assertContext(context);
          return certificationAddedSchema.parse({
            profileId,
            revision: expectedRevision + 1,
            entry,
          });
        },
      );
    },
    getContact: async (context: Context): Promise<UserContactDto> => {
      assertContext(context);
      const id = await authorize(context, "profile.read");
      return withPersonalAuditTransaction(
        db,
        context.actor.userId,
        {
          ...event(context, "profile.viewed", id),
          metadata: { permission: "profile.read", status: "contact_read" },
        },
        async (tx) => {
          assertContext(context);
          const contact = await tx.userContact.findUnique({
            where: { profileId: id },
          });
          if (!contact) {
            return userContactSchema.parse({
              id: randomUUID(),
              profileId: id,
              email: null,
              phone: null,
              address: null,
              linkedinUrl: null,
              githubUrl: null,
              portfolioUrl: null,
              updatedAt: new Date(now()).toISOString(),
            });
          }
          return userContactSchema.parse({
            id: contact.id,
            profileId: contact.profileId,
            email: contact.email,
            phone: contact.phone,
            address: contact.address,
            linkedinUrl: contact.linkedinUrl,
            githubUrl: contact.githubUrl,
            portfolioUrl: contact.portfolioUrl,
            updatedAt: contact.updatedAt.toISOString(),
          });
        },
      );
    },
    updateContact: async (
      context: Context,
      input: unknown,
    ): Promise<UserContactDto> => {
      assertContext(context);
      const parsed = userContactUpdateSchema.safeParse(input);
      if (!parsed.success) throw new ProfileError("invalid_input");
      const id = await authorize(context, "profile.update");
      return withPersonalAuditTransaction(
        db,
        context.actor.userId,
        {
          ...event(context, "profile.updated", id),
          metadata: { permission: "profile.update", status: "contact_updated" },
        },
        async (tx) => {
          assertContext(context);
          const data = parsed.data;
          const contact = await tx.userContact.upsert({
            where: { profileId: id },
            create: {
              id: randomUUID(),
              profileId: id,
              email: data.email ?? null,
              phone: data.phone ?? null,
              address: data.address ?? null,
              linkedinUrl: data.linkedinUrl ?? null,
              githubUrl: data.githubUrl ?? null,
              portfolioUrl: data.portfolioUrl ?? null,
            },
            update: {
              ...(data.email !== undefined && { email: data.email }),
              ...(data.phone !== undefined && { phone: data.phone }),
              ...(data.address !== undefined && { address: data.address }),
              ...(data.linkedinUrl !== undefined && { linkedinUrl: data.linkedinUrl }),
              ...(data.githubUrl !== undefined && { githubUrl: data.githubUrl }),
              ...(data.portfolioUrl !== undefined && { portfolioUrl: data.portfolioUrl }),
            },
          });
          return userContactSchema.parse({
            id: contact.id,
            profileId: contact.profileId,
            email: contact.email,
            phone: contact.phone,
            address: contact.address,
            linkedinUrl: contact.linkedinUrl,
            githubUrl: contact.githubUrl,
            portfolioUrl: contact.portfolioUrl,
            updatedAt: contact.updatedAt.toISOString(),
          });
        },
      );
    },
    deleteExperience: async (
      context: Context,
      entryId: string,
      input: unknown,
    ): Promise<SectionDeleteResultDto> => {
      assertContext(context);
      const parsed = sectionDeleteInputSchema.safeParse(input);
      if (!z.string().uuid().safeParse(entryId).success || !parsed.success)
        throw new ProfileError("invalid_input");
      const profileId = await authorize(context, "profile.update");
      return withPersonalAuditTransaction(
        db,
        context.actor.userId,
        {
          ...event(context, "profile.updated", profileId),
          metadata: {
            permission: "profile.update",
            status: "experience_deleted",
          },
        },
        async (tx) => {
          assertContext(context);
          const { expectedRevision } = parsed.data;
          const parent = await tx.userProfile.updateMany({
            where: {
              id: profileId,
              userId: context.actor.userId,
              revision: expectedRevision,
            },
            data: { revision: { increment: 1 } },
          });
          if (parent.count !== 1) throw new ProfileError("revision_conflict");
          const deleted = await tx.experience.deleteMany({
            where: {
              id: entryId,
              profileId,
              profile: { userId: context.actor.userId },
            },
          });
          if (deleted.count !== 1) throw new ProfileError("not_found");
          assertContext(context);
          return sectionDeleteResultSchema.parse({
            profileId,
            revision: expectedRevision + 1,
            deletedEntryId: entryId,
          });
        },
      );
    },
    deleteEducation: async (
      context: Context,
      entryId: string,
      input: unknown,
    ): Promise<SectionDeleteResultDto> => {
      assertContext(context);
      const parsed = sectionDeleteInputSchema.safeParse(input);
      if (!z.string().uuid().safeParse(entryId).success || !parsed.success)
        throw new ProfileError("invalid_input");
      const profileId = await authorize(context, "profile.update");
      return withPersonalAuditTransaction(
        db,
        context.actor.userId,
        {
          ...event(context, "profile.updated", profileId),
          metadata: {
            permission: "profile.update",
            status: "education_deleted",
          },
        },
        async (tx) => {
          assertContext(context);
          const { expectedRevision } = parsed.data;
          const parent = await tx.userProfile.updateMany({
            where: {
              id: profileId,
              userId: context.actor.userId,
              revision: expectedRevision,
            },
            data: { revision: { increment: 1 } },
          });
          if (parent.count !== 1) throw new ProfileError("revision_conflict");
          const deleted = await tx.education.deleteMany({
            where: {
              id: entryId,
              profileId,
              profile: { userId: context.actor.userId },
            },
          });
          if (deleted.count !== 1) throw new ProfileError("not_found");
          assertContext(context);
          return sectionDeleteResultSchema.parse({
            profileId,
            revision: expectedRevision + 1,
            deletedEntryId: entryId,
          });
        },
      );
    },
    deleteSkill: async (
      context: Context,
      entryId: string,
      input: unknown,
    ): Promise<SectionDeleteResultDto> => {
      assertContext(context);
      const parsed = sectionDeleteInputSchema.safeParse(input);
      if (!z.string().uuid().safeParse(entryId).success || !parsed.success)
        throw new ProfileError("invalid_input");
      const profileId = await authorize(context, "profile.update");
      return withPersonalAuditTransaction(
        db,
        context.actor.userId,
        {
          ...event(context, "profile.updated", profileId),
          metadata: {
            permission: "profile.update",
            status: "skill_deleted",
          },
        },
        async (tx) => {
          assertContext(context);
          const { expectedRevision } = parsed.data;
          const parent = await tx.userProfile.updateMany({
            where: {
              id: profileId,
              userId: context.actor.userId,
              revision: expectedRevision,
            },
            data: { revision: { increment: 1 } },
          });
          if (parent.count !== 1) throw new ProfileError("revision_conflict");
          const deleted = await tx.skill.deleteMany({
            where: {
              id: entryId,
              profileId,
              profile: { userId: context.actor.userId },
            },
          });
          if (deleted.count !== 1) throw new ProfileError("not_found");
          assertContext(context);
          return sectionDeleteResultSchema.parse({
            profileId,
            revision: expectedRevision + 1,
            deletedEntryId: entryId,
          });
        },
      );
    },
    deleteProject: async (
      context: Context,
      entryId: string,
      input: unknown,
    ): Promise<SectionDeleteResultDto> => {
      assertContext(context);
      const parsed = sectionDeleteInputSchema.safeParse(input);
      if (!z.string().uuid().safeParse(entryId).success || !parsed.success)
        throw new ProfileError("invalid_input");
      const profileId = await authorize(context, "profile.update");
      return withPersonalAuditTransaction(
        db,
        context.actor.userId,
        {
          ...event(context, "profile.updated", profileId),
          metadata: {
            permission: "profile.update",
            status: "project_deleted",
          },
        },
        async (tx) => {
          assertContext(context);
          const { expectedRevision } = parsed.data;
          const parent = await tx.userProfile.updateMany({
            where: {
              id: profileId,
              userId: context.actor.userId,
              revision: expectedRevision,
            },
            data: { revision: { increment: 1 } },
          });
          if (parent.count !== 1) throw new ProfileError("revision_conflict");
          const deleted = await tx.userProject.deleteMany({
            where: {
              id: entryId,
              profileId,
              profile: { userId: context.actor.userId },
            },
          });
          if (deleted.count !== 1) throw new ProfileError("not_found");
          assertContext(context);
          return sectionDeleteResultSchema.parse({
            profileId,
            revision: expectedRevision + 1,
            deletedEntryId: entryId,
          });
        },
      );
    },
    deleteCertification: async (
      context: Context,
      entryId: string,
      input: unknown,
    ): Promise<SectionDeleteResultDto> => {
      assertContext(context);
      const parsed = sectionDeleteInputSchema.safeParse(input);
      if (!z.string().uuid().safeParse(entryId).success || !parsed.success)
        throw new ProfileError("invalid_input");
      const profileId = await authorize(context, "profile.update");
      return withPersonalAuditTransaction(
        db,
        context.actor.userId,
        {
          ...event(context, "profile.updated", profileId),
          metadata: {
            permission: "profile.update",
            status: "certification_deleted",
          },
        },
        async (tx) => {
          assertContext(context);
          const { expectedRevision } = parsed.data;
          const parent = await tx.userProfile.updateMany({
            where: {
              id: profileId,
              userId: context.actor.userId,
              revision: expectedRevision,
            },
            data: { revision: { increment: 1 } },
          });
          if (parent.count !== 1) throw new ProfileError("revision_conflict");
          const deleted = await tx.certification.deleteMany({
            where: {
              id: entryId,
              profileId,
              profile: { userId: context.actor.userId },
            },
          });
          if (deleted.count !== 1) throw new ProfileError("not_found");
          assertContext(context);
          return sectionDeleteResultSchema.parse({
            profileId,
            revision: expectedRevision + 1,
            deletedEntryId: entryId,
          });
        },
      );
    },
    completeOnboarding: async (
      context: Context,
      input: unknown,
    ): Promise<ProfileCompleteResultDto> => {
      assertContext(context);
      const parsed = profileCompleteInputSchema.safeParse(input);
      if (!parsed.success) throw new ProfileError("invalid_input");
      const profileId = await authorize(context, "profile.update");
      return withPersonalAuditTransaction(
        db,
        context.actor.userId,
        {
          ...event(context, "profile.updated", profileId),
          metadata: {
            permission: "profile.update",
            status: "onboarding_completed",
          },
        },
        async (tx) => {
          assertContext(context);
          const { expectedRevision } = parsed.data;
          const existing = await tx.userProfile.findFirst({
            where: {
              id: profileId,
              userId: context.actor.userId,
            },
            select: {
              id: true,
              revision: true,
              onboardingCompletedAt: true,
            },
          });
          if (!existing) throw new ProfileError("not_found");
          if (existing.onboardingCompletedAt !== null)
            throw new ProfileError("onboarding_complete");
          if (existing.revision !== expectedRevision)
            throw new ProfileError("revision_conflict");

          const updated = await tx.userProfile.update({
            where: { id: profileId },
            data: {
              onboardingCompletedAt: new Date(now()),
              revision: { increment: 1 },
            },
            select: {
              id: true,
              onboardingCompletedAt: true,
              revision: true,
            },
          });
          return profileCompleteResultSchema.parse({
            id: updated.id,
            onboardingCompletedAt:
              updated.onboardingCompletedAt?.toISOString() ??
              new Date(now()).toISOString(),
            revision: updated.revision,
          });
        },
      );
    },
    read: (context: Context) => execute(context, "read"),
    update: (context: Context, input: unknown) =>
      execute(context, "update", input),
    saveDraft: (context: Context, input: unknown) =>
      execute(context, "draft", input),
  };
}
