import pg from "pg";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

const poolConfig = connectionString
  ? { connectionString }
  : {
      host: process.env.PGHOST,
      port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD
    };

const sslEnabled =
  process.env.NODE_ENV === "production" ||
  process.env.DATABASE_SSL === "true" ||
  process.env.PGSSLMODE === "require" ||
  (connectionString && connectionString.includes("supabase.com"));

const pool = new Pool({
  ...poolConfig,
  ssl: sslEnabled ? { rejectUnauthorized: false } : false
});

export const query = (text, params) => pool.query(text, params);
export const getClient = () => pool.connect();
export default pool;
