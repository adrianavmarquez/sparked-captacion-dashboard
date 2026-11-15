import type { Review } from '../../src/data/model';
import { discardReason, type CatalogProspect, type ImportCounts, type PreparedImport } from './prepare';
import type { CatalogSnapshot } from '../store/types';

export type { CatalogSnapshot };

export function emptyCatalog(): CatalogSnapshot {
  return { companies: [], prospects: [], evidence: [], contacts: [] };
}

export function importIntoCatalog(catalog: CatalogSnapshot, reviews: Review[], batch: PreparedImport): {
  catalog: CatalogSnapshot;
  reviews: Review[];
  counts: ImportCounts;
} {
  const next: CatalogSnapshot = {
    companies: [...catalog.companies],
    prospects: [...catalog.prospects],
    evidence: [...catalog.evidence],
    contacts: [...catalog.contacts],
  };
  const counts: ImportCounts = {
    companies: upsert(next.companies, batch.companies, (row) => row.id),
    prospects: upsert(next.prospects, batch.prospects, (row) => row.id),
    evidence: upsert(next.evidence, batch.evidence, (row) => row.id),
    contacts: upsert(next.contacts, batch.contacts, (row) => row.id),
    reviewsCreated: 0,
    ghlWrites: 'disabled',
  };
  const created: Review[] = [];
  const seen = new Set(reviews.map((review) => review.prospectId));
  for (const prospect of batch.prospects) {
    if (prospect.statusProposed !== 'Descartado' || seen.has(prospect.id)) continue;
    created.push(discardReview(prospect));
    seen.add(prospect.id);
  }
  counts.reviewsCreated = created.length;
  return { catalog: next, reviews: created, counts };
}

function upsert<T>(target: T[], incoming: T[], idOf: (row: T) => string): { inserted: number; updated: number } {
  let inserted = 0;
  let updated = 0;
  const index = new Map(target.map((row, i) => [idOf(row), i]));
  for (const row of incoming) {
    const at = index.get(idOf(row));
    if (at == null) {
      index.set(idOf(row), target.length);
      target.push(row);
      inserted += 1;
    } else {
      target[at] = row;
      updated += 1;
    }
  }
  return { inserted, updated };
}

function discardReview(prospect: CatalogProspect): Review {
  return {
    id: `rv_import_${prospect.id}`,
    prospectId: prospect.id,
    decision: 'discard',
    reason: discardReason(prospect),
    revisitOn: null,
    decidedBy: 'adri',
    decidedAt: prospect.createdAt,
  };
}
