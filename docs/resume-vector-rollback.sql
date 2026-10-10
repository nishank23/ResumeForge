-- Stop resume service before cache rollback. Source resumes/versions remain intact.
-- Restore the previous application/runtime grant contract before restart.
DROP TRIGGER IF EXISTS resume_search_invalidate ON "Resume";
DROP FUNCTION IF EXISTS resume_search_invalidate();
DROP TABLE IF EXISTS "ResumeSearchChunk";
-- Keep the shared vector extension installed. Migration history reconciliation is operator-owned.
