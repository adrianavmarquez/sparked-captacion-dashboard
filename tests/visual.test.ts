import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { strings } from '../src/data/strings';

const unchanged = [
  'global.css',
  'tokens.css',
  'tokens.json',
  'Shell.tsx',
  'ui.tsx',
  'index.html',
  'fonts.css',
  'Prospectos.tsx',
  'Ficha.tsx',
  'Seguimientos.tsx',
  'Borradores.tsx',
];

const sources: Record<string, string> = {
  'global.css': 'src/styles/global.css',
  'tokens.css': 'src/styles/tokens.css',
  'tokens.json': 'src/tokens/tokens.json',
  'Shell.tsx': 'src/components/Shell.tsx',
  'ui.tsx': 'src/components/ui.tsx',
  'index.html': 'index.html',
  'fonts.css': 'public/fonts.css',
  'Prospectos.tsx': 'src/views/Prospectos.tsx',
  'Ficha.tsx': 'src/views/Ficha.tsx',
  'Pipeline.tsx': 'src/views/Pipeline.tsx',
  'Seguimientos.tsx': 'src/views/Seguimientos.tsx',
  'Borradores.tsx': 'src/views/Borradores.tsx',
  'Hoy.tsx': 'src/views/Hoy.tsx',
  'Criterios.tsx': 'src/views/Criterios.tsx',
  'Ingresos.tsx': 'src/views/Ingresos.tsx',
};

function baseline(name: string): string {
  return readFileSync(`tests/baselines/${name}`, 'utf8');
}

function classTokens(source: string): string[] {
  const raw = [...source.matchAll(/className=(?:"([^"]+)"|'([^']+)')/g)].map((match) => match[1] || match[2]).join(' ');
  return [...new Set(raw.split(/\s+/).filter(Boolean))].sort();
}

describe('la interfaz aprobada no cambia de diseño', () => {
  it('conserva estilos, navegación y vistas que no necesitaban texto de cálculo', () => {
    for (const name of unchanged) {
      expect(readFileSync(sources[name], 'utf8')).toBe(baseline(name));
    }
  });

  it('Hoy, Criterios, Ingresos y Pipeline no introducen clases nuevas', () => {
    for (const name of ['Hoy.tsx', 'Criterios.tsx', 'Ingresos.tsx', 'Pipeline.tsx']) {
      const before = new Set(classTokens(baseline(name)));
      for (const token of classTokens(readFileSync(sources[name], 'utf8'))) expect(before.has(token)).toBe(true);
    }
  });

  it('mantiene los nombres de navegación y de las pantallas', () => {
    expect(strings.nav).toEqual({
      hoy: 'Hoy', prospectos: 'Prospectos', pipeline: 'Pipeline', seguimientos: 'Seguimientos',
      borradores: 'Borradores', criterios: 'Criterios', ingresos: 'Ingresos',
    });
    expect(strings.hoy.title).toBe('Hoy');
    expect(strings.ingresos.title).toBe('Ingresos');
    expect(strings.pipeline.title).toBe('Pipeline');
    expect(readFileSync('src/views/Ingresos.tsx', 'utf8')).not.toContain('LIST_PRICE');
    expect(readFileSync('src/views/Ingresos.tsx', 'utf8')).not.toContain('precio de lista');
  });
});
