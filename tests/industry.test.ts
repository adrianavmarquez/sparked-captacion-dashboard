import { describe, expect, it } from 'vitest';
import { MockAdapter } from '../src/data/adapter';
import { fixtures } from '../src/data/fixtures';

describe('filtro de rubro', () => {
  it('lista los rubros distintos y se combina con los otros filtros', async () => {
    const adapter = new MockAdapter({ current: 'normal' }, fixtures);
    const all = await adapter.listProspects({}, 1, 999);
    const counts = new Map<string, number>();
    for (const row of all.items) counts.set(row.company.industry, (counts.get(row.company.industry) ?? 0) + 1);
    expect(counts.get('Restaurante')).toBe(1);
    expect(counts.size).toBeGreaterThan(1);

    const only = await adapter.listProspects({ industry: 'Restaurante' }, 1, 20);
    expect(only.total).toBe(1);
    expect(only.items[0].company.name).toBe('Negocio de ejemplo A');

    const combined = await adapter.listProspects({ industry: 'Restaurante', locality: 'Villa Ejemplo' }, 1, 20);
    expect(combined.total).toBe(0);
    const samePlace = await adapter.listProspects({ industry: 'Restaurante', locality: 'Ciudad Ejemplo Norte' }, 1, 20);
    expect(samePlace.total).toBe(1);

    const todos = await adapter.listProspects({ industry: 'all', offer: 'core' }, 1, 99);
    expect(todos.items.every((row) => row.prospect.offerInterest === 'core')).toBe(true);
    expect(todos.total).toBeGreaterThan(1);
  });
});
