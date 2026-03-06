import { neon } from '@neondatabase/serverless';

interface SqlClient {
  (strings: TemplateStringsArray, ...params: any[]): Promise<Record<string, any>[]>;
  (query: string, params?: any[], opts?: any): Promise<Record<string, any>[]>;
}

const sql: SqlClient = process.env.DATABASE_URL
  ? (neon(process.env.DATABASE_URL) as unknown as SqlClient)
  : ((() => { throw new Error('DATABASE_URL not set'); }) as unknown as SqlClient);

export default sql;
