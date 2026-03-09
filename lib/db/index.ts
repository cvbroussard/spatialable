import { neon } from '@neondatabase/serverless';

type Rows = Record<string, any>[];

interface SqlClient {
  (strings: TemplateStringsArray, ...params: any[]): Promise<Rows>;
  query(text: string, params?: any[]): Promise<Rows>;
}

const _sql = process.env.DATABASE_URL
  ? neon(process.env.DATABASE_URL)
  : null;

const sql: SqlClient = _sql as unknown as SqlClient;
if (!sql) throw new Error('DATABASE_URL not set');

/** Conventional parameterized query with $1, $2 placeholders. */
export async function query(text: string, params?: any[]): Promise<Rows> {
  return sql.query(text, params);
}

export default sql;
