-- Additive private cache; no source resume, version or profile mutation.
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE "ResumeSearchChunk" (
 "id" UUID PRIMARY KEY,
 "versionId" UUID NOT NULL REFERENCES "ResumeVersion"("id") ON DELETE CASCADE,
 "resumeId" UUID NOT NULL,
 "ownerUserId" UUID NOT NULL,
 "workspaceId" UUID NOT NULL,
 "sectionId" TEXT NOT NULL,
 "itemId" TEXT NOT NULL,
 "model" TEXT NOT NULL CHECK ("model" = 'gemini-embedding-001'),
 "dimensions" INTEGER NOT NULL CHECK ("dimensions" = 768),
 "projectionVersion" TEXT NOT NULL CHECK ("projectionVersion" = 'professional-v1'),
 "sourceHash" TEXT NOT NULL CHECK ("sourceHash" ~ '^[a-f0-9]{64}$'),
 "text" TEXT NOT NULL CHECK (length("text") BETWEEN 1 AND 6000),
 "embedding" vector(768) NOT NULL,
 "generatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ResumeSearchChunk_versionId_sectionId_itemId_model_projectionVer_key"
 ON "ResumeSearchChunk"("versionId","sectionId","itemId","model","projectionVersion");
CREATE INDEX "ResumeSearchChunk_ownerUserId_workspaceId_resumeId_versionId_idx"
 ON "ResumeSearchChunk"("ownerUserId","workspaceId","resumeId","versionId");
CREATE INDEX "ResumeSearchChunk_embedding_cosine_idx" ON "ResumeSearchChunk" USING hnsw ("embedding" vector_cosine_ops);
ALTER TABLE "ResumeSearchChunk" ENABLE ROW LEVEL SECURITY;
-- Settings are transaction-local and set only from the authenticated service actor.
CREATE POLICY resume_search_read ON "ResumeSearchChunk" FOR SELECT USING (
 "ownerUserId"::text = current_setting('resume_forge.actor', true)
 AND "workspaceId"::text = current_setting('resume_forge.workspace', true)
 AND EXISTS (SELECT 1 FROM "Resume" r JOIN "ResumeVersion" v ON v."resumeId"=r.id
   WHERE r.id="ResumeSearchChunk"."resumeId" AND v.id="ResumeSearchChunk"."versionId"
   AND r."ownerUserId"="ResumeSearchChunk"."ownerUserId" AND r."workspaceId"="ResumeSearchChunk"."workspaceId"
   AND r.status <> 'deleted' AND r."currentVersion"=v."versionNumber")
);
CREATE POLICY resume_search_insert ON "ResumeSearchChunk" FOR INSERT WITH CHECK (
 "ownerUserId"::text = current_setting('resume_forge.actor', true)
 AND "workspaceId"::text = current_setting('resume_forge.workspace', true)
 AND EXISTS (SELECT 1 FROM "Resume" r JOIN "ResumeVersion" v ON v."resumeId"=r.id
   WHERE r.id="ResumeSearchChunk"."resumeId" AND v.id="ResumeSearchChunk"."versionId"
   AND r."ownerUserId"="ResumeSearchChunk"."ownerUserId" AND r."workspaceId"="ResumeSearchChunk"."workspaceId"
   AND r.status <> 'deleted' AND r."currentVersion"=v."versionNumber")
);
CREATE POLICY resume_search_delete ON "ResumeSearchChunk" FOR DELETE USING (
 "ownerUserId"::text = current_setting('resume_forge.actor', true)
 AND "workspaceId"::text = current_setting('resume_forge.workspace', true)
);

-- Purge derived cache atomically on every saved-version change or soft deletion.
-- The service cannot mutate immutable versions; this narrow owner function only deletes cache rows.
CREATE FUNCTION resume_search_invalidate() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
 SET search_path=pg_catalog AS $$
BEGIN
 IF NEW."currentVersion" <> OLD."currentVersion" OR NEW.status = 'deleted' THEN
  DELETE FROM public."ResumeSearchChunk" WHERE "resumeId"=NEW.id;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION resume_search_invalidate() FROM PUBLIC;
CREATE TRIGGER resume_search_invalidate AFTER UPDATE OF "currentVersion",status ON "Resume"
 FOR EACH ROW EXECUTE FUNCTION resume_search_invalidate();
