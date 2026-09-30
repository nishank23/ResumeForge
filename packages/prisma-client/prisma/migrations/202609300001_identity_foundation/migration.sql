-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "WorkspaceType" AS ENUM ('individual', 'organization', 'vendor');

-- CreateEnum
CREATE TYPE "OAuthProvider" AS ENUM ('google', 'linkedin');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthAccount" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" "OAuthProvider" NOT NULL,
    "providerSubject" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "refreshHash" CHAR(64) NOT NULL,
    "familyId" UUID NOT NULL,
    "replacedById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" UUID NOT NULL,
    "type" "WorkspaceType" NOT NULL,
    "personalOwnerUserId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "location" TEXT,
    "professionalSummary" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "onboardingCompletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserContact" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "linkedinUrl" TEXT,
    "githubUrl" TEXT,
    "portfolioUrl" TEXT,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "UserContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileWorkspaceGrant" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "grantedByUserId" UUID NOT NULL,
    "canReadProfile" BOOLEAN NOT NULL DEFAULT false,
    "canWriteProfile" BOOLEAN NOT NULL DEFAULT false,
    "canReadContact" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ProfileWorkspaceGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "OAuthAccount_userId_idx" ON "OAuthAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAccount_provider_providerSubject_key" ON "OAuthAccount"("provider", "providerSubject");

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshHash_key" ON "Session"("refreshHash");

-- CreateIndex
CREATE UNIQUE INDEX "Session_replacedById_key" ON "Session"("replacedById");

-- CreateIndex
CREATE INDEX "Session_userId_revokedAt_idx" ON "Session"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "Session_familyId_idx" ON "Session"("familyId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_personalOwnerUserId_key" ON "Workspace"("personalOwnerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_id_userId_key" ON "UserProfile"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserContact_profileId_key" ON "UserContact"("profileId");

-- CreateIndex
CREATE INDEX "ProfileWorkspaceGrant_workspaceId_revokedAt_profileId_idx" ON "ProfileWorkspaceGrant"("workspaceId", "revokedAt", "profileId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileWorkspaceGrant_profileId_workspaceId_key" ON "ProfileWorkspaceGrant"("profileId", "workspaceId");

-- AddForeignKey
ALTER TABLE "OAuthAccount" ADD CONSTRAINT "OAuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_replacedById_fkey" FOREIGN KEY ("replacedById") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_personalOwnerUserId_fkey" FOREIGN KEY ("personalOwnerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserContact" ADD CONSTRAINT "UserContact_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileWorkspaceGrant" ADD CONSTRAINT "ProfileWorkspaceGrant_profileId_grantedByUserId_fkey" FOREIGN KEY ("profileId", "grantedByUserId") REFERENCES "UserProfile"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileWorkspaceGrant" ADD CONSTRAINT "ProfileWorkspaceGrant_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma does not express CHECK constraints. Preserve these in future migrations.
ALTER TABLE "Workspace" ADD CONSTRAINT "personal_workspace_owner"
CHECK (("type" = 'individual') = ("personalOwnerUserId" IS NOT NULL));
ALTER TABLE "UserProfile" ADD CONSTRAINT "positive_profile_revision" CHECK ("revision" > 0);
ALTER TABLE "Session" ADD CONSTRAINT "refresh_hash_format" CHECK ("refreshHash" ~ '^[a-f0-9]{64}$');
ALTER TABLE "Session" ADD CONSTRAINT "session_expiry" CHECK ("expiresAt" > "createdAt");
ALTER TABLE "Session" ADD CONSTRAINT "no_self_rotation" CHECK ("replacedById" IS NULL OR "replacedById" <> "id");
ALTER TABLE "ProfileWorkspaceGrant" ADD CONSTRAINT "grant_read_before_write"
CHECK (NOT "canWriteProfile" OR "canReadProfile");
