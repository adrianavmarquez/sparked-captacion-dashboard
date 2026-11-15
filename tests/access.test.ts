import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MockAdapter } from '../src/data/adapter';
import { resolveAccess } from '../src/data/access';
import { emptyDataset } from '../src/data/empty';

describe('candado', () => {
  it('sin sesión no abre la app, salvo el build de demostración', () => {
    expect(resolveAccess({ demoBuild: false, authenticated: false })).toBe('locked');
    expect(resolveAccess({ demoBuild: true, authenticated: false })).toBe('demo');
    expect(resolveAccess({ demoBuild: false, authenticated: true })).toBe('live');
    expect(resolveAccess({ demoBuild: true, authenticated: true })).toBe('live');
  });

  it('un catálogo vacío no trae borradores ni negocios de ejemplo', async () => {
    const adapter = new MockAdapter({ current: 'normal' }, emptyDataset());
    expect(await adapter.listDrafts()).toEqual([]);
    const page = await adapter.listProspects({}, 1, 8);
    expect(page.total).toBe(0);
    expect(page.items).toEqual([]);
  });

  it('la sesión real no importa el archivo de fixtures en el arranque', () => {
    const store = readFileSync('src/lib/store.tsx', 'utf8');
    const adapter = readFileSync('src/data/adapter.ts', 'utf8');
    expect(adapter).not.toContain("from './fixtures'");
    expect(store).toContain("import.meta.env.VITE_DEMO === '1'");
    expect(store).toContain('clearDemoDrafts');
    const shell = readFileSync('src/components/Shell.tsx', 'utf8');
    expect(shell).toContain('LockScreen');
    expect(shell).toContain('En vivo · GHL solo lectura · no envía nada');
    expect(shell).toContain("access !== 'live' && access !== 'demo'");
  });
});

describe('banner', () => {
  it('no queda fijo encima del contenido ni de la navegación', () => {
    const css = readFileSync('src/styles/global.css', 'utf8');
    const start = css.indexOf('.banner {');
    const block = css.slice(start, css.indexOf('}', start));
    expect(block).toContain('position: static');
    expect(block).not.toContain('sticky');
    expect(block).not.toContain('z-index: 20');
  });
});
