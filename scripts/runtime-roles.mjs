import { createRequire } from "node:module";
import {
  RUNTIME_GRANTS,
  RUNTIME_FUNCTIONS,
  runtimeRoleNames,
} from "../packages/prisma-client/dist/index.js";
const pg = createRequire(
  new URL("../packages/prisma-client/package.json", import.meta.url),
)("pg");
export const Client = pg.Client;
const marker = "resume-forge managed local runtime v1";
const identifier = (value) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(value))
    throw new Error("Invalid runtime identifier");
  return pg.escapeIdentifier(value);
};

// Cluster-global roles are operator setup, not hosted/Prisma application migrations.
export async function provisionRuntimeRoles(
  admin,
  { databaseName, prefix = "rf_local", passwords },
) {
  const names = runtimeRoleNames(prefix);
  const {
    rows: [owner],
  } = await admin.query(
    "SELECT current_database() AS db, current_user AS owner",
  );
  if (owner.db !== databaseName)
    throw new Error("Wrong runtime provisioning database");
  const roles = Object.values(names).map(identifier).join(", ");
  const database = identifier(databaseName);
  const migrationOwner = identifier(owner.owner);
  await admin.query("BEGIN");
  try {
    await admin.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `resume-forge:${prefix}`,
    ]);
    for (const [service, name] of Object.entries(names)) {
      if (!/^[0-9a-f]{64}$/.test(passwords[service] ?? ""))
        throw new Error("Invalid runtime credential");
      const existing = await admin.query(
        "SELECT oid, shobj_description(oid, 'pg_authid') AS marker FROM pg_roles WHERE rolname = $1",
        [name],
      );
      if (existing.rowCount && existing.rows[0].marker !== marker)
        throw new Error("Runtime role name collision");
      if (existing.rowCount) {
        const grants = await admin.query(
          "SELECT 1 FROM pg_auth_members WHERE member = $1 OR roleid = $1",
          [existing.rows[0].oid],
        );
        const owns = await admin.query(
          "SELECT 1 FROM pg_shdepend WHERE refclassid = 'pg_authid'::regclass AND refobjid = $1 AND deptype = 'o'",
          [existing.rows[0].oid],
        );
        if (grants.rowCount || owns.rowCount)
          throw new Error("Unexpected runtime role ownership or membership");
      } else await admin.query(`CREATE ROLE ${identifier(name)} NOLOGIN`);
      await admin.query(
        `ALTER ROLE ${identifier(name)} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT PASSWORD ${pg.escapeLiteral(passwords[service])}`,
      );
      await admin.query(
        `COMMENT ON ROLE ${identifier(name)} IS ${pg.escapeLiteral(marker)}`,
      );
      await admin.query(
        `ALTER ROLE ${identifier(name)} IN DATABASE ${database} SET search_path TO public, pg_catalog`,
      );
    }
    await admin.query(
      `REVOKE ALL ON DATABASE ${database} FROM PUBLIC, ${roles}`,
    );
    await admin.query(`GRANT CONNECT ON DATABASE ${database} TO ${roles}`);
    await admin.query(`REVOKE ALL ON SCHEMA public FROM PUBLIC, ${roles}`);
    await admin.query(`GRANT USAGE ON SCHEMA public TO ${roles}`);
    for (const kind of ["TABLES", "SEQUENCES", "FUNCTIONS"]) {
      await admin.query(
        `REVOKE ALL ON ALL ${kind} IN SCHEMA public FROM PUBLIC, ${roles}`,
      );
      // Global defaults: schema-only REVOKE cannot remove PUBLIC's function default.
      await admin.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${migrationOwner} REVOKE ALL ON ${kind} FROM PUBLIC, ${roles}`,
      );
      await admin.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${migrationOwner} IN SCHEMA public REVOKE ALL ON ${kind} FROM PUBLIC, ${roles}`,
      );
    }
    // REVOKE table-level privileges does not remove separately granted column ACLs.
    const { rows: columns } = await admin.query(
      "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'",
    );
    const tables = new Map();
    for (const column of columns)
      tables.set(column.table_name, [
        ...(tables.get(column.table_name) ?? []),
        identifier(column.column_name),
      ]);
    for (const [table, columns] of tables) {
      await admin.query(
        `REVOKE SELECT (${columns}), INSERT (${columns}), UPDATE (${columns}), REFERENCES (${columns}) ON public.${identifier(table)} FROM PUBLIC, ${roles}`,
      );
    }
    for (const [service, grants] of Object.entries(RUNTIME_GRANTS))
      for (const grant of grants) {
        const columns = grant.columns
          ? ` (${grant.columns.map(identifier).join(", ")})`
          : "";
        await admin.query(
          `GRANT ${grant.privilege}${columns} ON public.${identifier(grant.table)} TO ${identifier(names[service])}`,
        );
      }
    for (const [service, signatures] of Object.entries(RUNTIME_FUNCTIONS))
      for (const signature of signatures) {
        if (!/^[a-z_]+\([a-z_,\[\]]*\)$/.test(signature)) throw new Error("Invalid runtime function signature");
        await admin.query(`GRANT EXECUTE ON FUNCTION public.${signature} TO ${identifier(names[service])}`);
      }
    await admin.query("COMMIT");
    return names;
  } catch (error) {
    await admin.query("ROLLBACK");
    throw error;
  }
}
