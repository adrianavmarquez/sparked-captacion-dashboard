import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import type { SqlDb } from '../server/db/sql';
import { SqlReviewStore } from '../server/store/sql';

function wrap(pg: PGlite): SqlDb {
  const db: SqlDb = {
    async query<T>(sql: string, params: unknown[] = []) {
      const result = await pg.query<T>(sql, params);
      return result.rows;
    },
    async exec(sql: string) {
      await pg.exec(sql);
    },
    async transaction<T>(fn: (tx: SqlDb) => Promise<T>) {
      await pg.exec('BEGIN');
      try {
        const result = await fn(db);
        await pg.exec('COMMIT');
        return result;
      } catch (error) {
        await pg.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return db;
}

describe('postgres embebido', () => {
  it('aplica la migración y conserva null en vez de cero', async () => {
    const pg = new PGlite();
    const db = wrap(pg);
    const store = new SqlReviewStore(db, 'production');
    await SqlReviewStore.migrate(db);
    await store.savePayment({
      opportunityId: 'op_1', type: 'project_50pct', contractSigned: true, amountContracted: null,
      depositVerified: false, verifiedAt: null, depositReceived: null, balancePending: null,
      deliveredAt: null, balanceVerifiedAt: null, balanceReceived: null, depositMarkedAt: '2026-11-07T15:00:00-05:00',
    });
    await store.saveReview({
      id: 'rv_1', prospectId: 'pr_1', decision: 'maybe', reason: null, revisitOn: '2026-11-20',
      decidedBy: 'adri', decidedAt: '2026-11-07T15:00:00-05:00',
    });
    const loaded = await store.load();
    expect(loaded.payments[0].amountContracted).toBeNull();
    expect(loaded.payments[0].depositReceived).toBeNull();
    expect(loaded.payments[0].depositMarkedAt).toContain('2026-11-07');
    expect(loaded.reviews[0].revisitOn).toBe('2026-11-20');
    const cents = await db.query<{ deposit_received_cents: number | null }>('SELECT deposit_received_cents FROM payments');
    expect(cents[0].deposit_received_cents).toBeNull();
    await expect(db.query(
      `INSERT INTO payments (opportunity_id, type, contract_signed, deposit_verified) VALUES ('op_bad', 'project_50pct', true, true)`,
    )).rejects.toThrow();
    expect(() => new SqlReviewStore(db, 'demo')).toThrow(/demo/);
    await pg.close();
  });
});
