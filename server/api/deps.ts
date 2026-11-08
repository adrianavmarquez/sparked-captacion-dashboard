import type { Env } from '../env';
import { readEnv } from '../env';
import { MemoryReviewStore } from '../store/memory';
import type { StoreResult } from '../store/types';
import type { ApiDeps } from './handler';

const demoStore = new MemoryReviewStore('demo');

/**
 * Producción usa Postgres solo si NETLIFY_DB_URL ya existe.
 * No crea la base. La demo es otra instancia en memoria y no abre Postgres.
 */
export function createDefaultDeps(env: Env, fetchImpl?: typeof fetch): ApiDeps {
  return {
    env,
    now: () => new Date(),
    fetchImpl,
    stores: {
      demo: () => ({ ok: true, store: demoStore, durable: false, realm: 'demo' }),
      production: () => openProduction(env),
    },
  };
}

async function openProduction(env: Env): Promise<StoreResult> {
  const url = readEnv(env, 'NETLIFY_DB_URL');
  if (!url) return { ok: false, error: 'persistence_not_configured' };
  try {
    const { createPostgresDb } = await import('../db/postgres');
    const { SqlReviewStore } = await import('../store/sql');
    const db = await createPostgresDb(url);
    // Las migraciones no se aplican en runtime. Las aplica el deploy cuando Adri active Netlify Database.
    return { ok: true, store: new SqlReviewStore(db, 'production'), durable: true, realm: 'production' };
  } catch {
    return { ok: false, error: 'persistence_unavailable' };
  }
}
