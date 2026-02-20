import { getClient } from "../config/db.js";

export const wipeDatabaseData = async () => {
  const client = await getClient();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT tablename
       FROM pg_tables
       WHERE schemaname = 'public'
       ORDER BY tablename ASC`
    );

    const tables = rows.map((r) => r.tablename);
    if (tables.length) {
      const quoted = tables.map((t) => `"public"."${t}"`).join(", ");
      await client.query(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);
    }

    await client.query("COMMIT");
    return { truncatedTables: tables.length, tables };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
