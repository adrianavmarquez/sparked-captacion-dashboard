export interface SqlDb {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
  transaction<T>(fn: (db: SqlDb) => Promise<T>): Promise<T>;
}

export async function applySqlMigrations(db: SqlDb, files: { id: string; sql: string }[]): Promise<string[]> {
  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  const applied: string[] = [];
  const existing = await db.query<{ id: string }>('SELECT id FROM schema_migrations');
  const have = new Set(existing.map((row) => row.id));
  for (const file of files) {
    if (have.has(file.id)) continue;
    await db.transaction(async (tx) => {
      await tx.exec(file.sql);
      await tx.query('INSERT INTO schema_migrations (id) VALUES ($1)', [file.id]);
    });
    applied.push(file.id);
  }
  return applied;
}
