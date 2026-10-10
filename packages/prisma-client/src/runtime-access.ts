import type { PrismaClient } from "./generated/client.js";

export type RuntimeService =
  "auth" | "profile" | "resume" | "auditRelay" | "auditIngest";
export interface RuntimeGrant {
  table: string;
  privilege: "SELECT" | "INSERT" | "UPDATE" | "DELETE";
  columns?: readonly string[];
}
export function runtimeRoleNames(
  prefix = "rf_local",
): Record<RuntimeService, string> {
  if (!/^[a-z][a-z0-9_]{0,39}$/.test(prefix))
    throw new Error("Invalid runtime role prefix");
  return {
    auth: `${prefix}_auth`,
    profile: `${prefix}_profile`,
    resume: `${prefix}_resume`,
    auditRelay: `${prefix}_audit_relay`,
    auditIngest: `${prefix}_audit_ingest`,
  };
}
const workspaceScope = {
  table: "Workspace",
  privilege: "SELECT",
  columns: ["id", "type", "personalOwnerUserId"],
} as const;
export const RUNTIME_GRANTS: Readonly<
  Record<RuntimeService, readonly RuntimeGrant[]>
> = {
  auth: [
    ...["User", "OAuthAccount", "Session", "Workspace"].flatMap((table) => [
      { table, privilege: "SELECT" as const },
      { table, privilege: "INSERT" as const },
    ]),
    {
      table: "Session",
      privilege: "UPDATE",
      columns: ["revokedAt", "replacedById"],
    },
    {
      table: "UserProfile",
      privilege: "SELECT",
      columns: ["id", "userId", "onboardingCompletedAt"],
    },
  ],
  profile: [
    ...["UserProfile", "UserContact"].flatMap((table) =>
      (["SELECT", "INSERT", "UPDATE"] as const).map((privilege) => ({
        table,
        privilege,
      })),
    ),
    ...[
      "Education",
      "Experience",
      "Skill",
      "UserProject",
      "Certification",
    ].flatMap((table) =>
      (["SELECT", "INSERT", "UPDATE", "DELETE"] as const).map((privilege) => ({
        table,
        privilege,
      })),
    ),
    workspaceScope,
    { table: "AuditOutbox", privilege: "INSERT" },
  ],
  resume: [
    workspaceScope,
    { table: "UserProfile", privilege: "SELECT", columns: ["id", "userId"] },
    {
      table: "UserProfile",
      privilege: "INSERT",
      columns: ["id", "userId", "fullName", "createdAt", "updatedAt"],
    },
    ...["Resume", "ResumeVersion"].flatMap((table) =>
      (["SELECT", "INSERT"] as const).map((privilege) => ({
        table,
        privilege,
      })),
    ),
    {
      table: "Resume",
      privilege: "UPDATE",
      columns: [
        "content",
        "currentVersion",
        "updatedAt",
        "templateId",
        "status",
        "atsScore",
        "atsBreakdown",
        "pdfR2Key",
      ],
    },
    ...(["SELECT", "INSERT", "DELETE"] as const).map((privilege) => ({
      table: "ResumeSearchChunk",
      privilege,
    })),
    { table: "AuditOutbox", privilege: "INSERT" },
  ],
  auditRelay: [
    { table: "AuditOutbox", privilege: "SELECT" },
    {
      table: "AuditOutbox",
      privilege: "UPDATE",
      columns: [
        "deliveryState",
        "attempts",
        "nextAttemptAt",
        "leaseToken",
        "leaseExpiresAt",
        "deliveredAt",
        "lastErrorCode",
        "updatedAt",
      ],
    },
  ],
  auditIngest: [
    workspaceScope,
    { table: "AuditEvent", privilege: "INSERT" },
    {
      table: "AuditEvent",
      privilege: "SELECT",
      columns: ["id", "payloadHash"],
    },
  ],
};

export const RUNTIME_FUNCTIONS: Readonly<
  Record<RuntimeService, readonly string[]>
> = {
  auth: [],
  profile: [],
  auditRelay: [],
  auditIngest: [],
  resume: [
    "vector_in(cstring,oid,integer)",
    "vector_out(vector)",
    "vector_typmod_in(cstring[])",
    "cosine_distance(vector,vector)",
    "vector(vector,integer,boolean)",
  ],
};
/** Verify actual DB identity and grants; a URL username alone is not authority. */
export async function assertRuntimeDatabaseRole(
  db: PrismaClient,
  service: RuntimeService,
  expectedRole = runtimeRoleNames()[service],
): Promise<void> {
  const [identity] = await db.$queryRaw<
    { name: string; restricted: boolean }[]
  >`
    SELECT current_user::text AS name,
      (NOT r.rolsuper AND NOT r.rolcreatedb AND NOT r.rolcreaterole AND NOT r.rolreplication
       AND NOT r.rolbypassrls AND NOT r.rolinherit
       AND NOT EXISTS (SELECT 1 FROM pg_auth_members WHERE member = r.oid)
       AND NOT has_schema_privilege(current_user, 'public', 'CREATE')
       AND NOT has_database_privilege(current_user, current_database(), 'CREATE')
       AND NOT has_database_privilege(current_user, current_database(), 'TEMP')
       AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relowner = r.oid)) AS restricted
    FROM pg_roles r WHERE rolname = current_user
  `;
  if (identity?.name !== expectedRole || !identity.restricted)
    throw new Error("Unsafe runtime database access");
  // Check table AND column ACLs, including grants inherited through PUBLIC.
  const rights = await db.$queryRaw<
    { table: string; column: string; privilege: string; allowed: boolean }[]
  >`
    SELECT c.relname::text AS "table", a.attname::text AS "column", p.privilege,
      has_column_privilege(current_user, c.oid, a.attnum, p.privilege) AS allowed
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('REFERENCES')) p(privilege)
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m','f')
  `;
  const grants = RUNTIME_GRANTS[service];
  const columnGrants = grants.filter((grant) => grant.privilege !== "DELETE");
  if (
    columnGrants.some(
      (grant) => !rights.some((right) => right.table === grant.table),
    )
  )
    throw new Error("Unsafe runtime database access");
  for (const right of rights) {
    const expected = columnGrants.some(
      (grant) =>
        grant.table === right.table &&
        grant.privilege === right.privilege &&
        (grant.columns === undefined || grant.columns.includes(right.column)),
    );
    if (right.allowed !== expected)
      throw new Error("Unsafe runtime database access");
  }

  const deleteRights = await db.$queryRaw<
    { table: string; allowed: boolean }[]
  >`
    SELECT c.relname::text AS "table",
      has_table_privilege(current_user, c.oid, 'DELETE') AS allowed
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m','f')
  `;
  const deleteGrants = grants.filter((grant) => grant.privilege === "DELETE");
  for (const right of deleteRights) {
    const expected = deleteGrants.some((grant) => grant.table === right.table);
    if (right.allowed !== expected)
      throw new Error("Unsafe runtime database access");
  }

  const functions = await db.$queryRaw<
    { signature: string; allowed: boolean }[]
  >`
    SELECT p.oid::regprocedure::text AS signature, has_function_privilege(current_user,p.oid,'EXECUTE') AS allowed
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
  `;
  for (const fn of functions)
    if (fn.allowed !== RUNTIME_FUNCTIONS[service].includes(fn.signature))
      throw new Error("Unsafe runtime database access");
  const [extra] = await db.$queryRaw<{ forbidden: boolean }[]>`
    SELECT (
      EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m','f') AND
          (has_table_privilege(current_user, c.oid, 'TRUNCATE,TRIGGER,MAINTAIN'))) OR
      EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'S' AND
          has_sequence_privilege(current_user, c.oid, 'SELECT,UPDATE,USAGE')) OR
      EXISTS (SELECT 1 FROM information_schema.role_table_grants
        WHERE grantee = current_user AND is_grantable = 'YES') OR
      EXISTS (SELECT 1 FROM information_schema.role_column_grants
        WHERE grantee = current_user AND is_grantable = 'YES')
    ) AS forbidden
  `;
  if (extra?.forbidden) throw new Error("Unsafe runtime database access");
}
