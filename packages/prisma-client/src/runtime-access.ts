import type { PrismaClient } from "./generated/client.js";

export type RuntimeService = "auth" | "profile" | "auditRelay" | "auditIngest";
export interface RuntimeGrant {
  table: string;
  privilege: "SELECT" | "INSERT" | "UPDATE";
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
    ...[
      "UserProfile",
      "UserContact",
      "Education",
      "Experience",
      "Skill",
      "UserProject",
      "Certification",
    ].flatMap((table) =>
      (["SELECT", "INSERT", "UPDATE"] as const).map((privilege) => ({
        table,
        privilege,
      })),
    ),
    workspaceScope,
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
  if (
    grants.some((grant) => !rights.some((right) => right.table === grant.table))
  )
    throw new Error("Unsafe runtime database access");
  for (const right of rights) {
    const expected = grants.some(
      (grant) =>
        grant.table === right.table &&
        grant.privilege === right.privilege &&
        (grant.columns === undefined || grant.columns.includes(right.column)),
    );
    if (right.allowed !== expected)
      throw new Error("Unsafe runtime database access");
  }
  const [extra] = await db.$queryRaw<{ forbidden: boolean }[]>`
    SELECT (
      EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m','f') AND
          (has_table_privilege(current_user, c.oid, 'DELETE,TRUNCATE,TRIGGER,MAINTAIN'))) OR
      EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND has_function_privilege(current_user, p.oid, 'EXECUTE')) OR
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
