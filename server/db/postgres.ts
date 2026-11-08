import type { SqlDb } from './sql';

/** Se usa solo cuando NETLIFY_DB_URL existe. No registra la URL. */
export async function createPostgresDb(url: string): Promise<SqlDb> {
  const postgres = (await import('postgres')).default;
  const sql = postgres(url, { max: 1, idle_timeout: 20, connect_timeout: 10 });
  const db: SqlDb = {
    async query<T>(text: string, params: unknown[] = []) {
      const rows = await sql.unsafe(text, params as never[]);
      return rows as unknown as T[];
    },
    async exec(text: string) {
      await sql.unsafe(text);
    },
    async transaction<T>(fn: (tx: SqlDb) => Promise<T>): Promise<T> {
      const result = await sql.begin(async (tx) => {
        const scoped: SqlDb = {
          async query<TRow>(text: string, params: unknown[] = []) {
            const rows = await tx.unsafe(text, params as never[]);
            return rows as unknown as TRow[];
          },
          async exec(text: string) {
            await tx.unsafe(text);
          },
          transaction: (inner) => inner(scoped),
        };
        return fn(scoped);
      });
      return result as T;
    },
  };
  return db;
}
