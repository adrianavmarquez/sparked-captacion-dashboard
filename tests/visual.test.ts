import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { strings } from '../src/data/strings';

const unchanged = [
  'src/styles/global.css',
  'src/styles/tokens.css',
  'src/tokens/tokens.json',
  'src/components/Shell.tsx',
  'src/components/ui.tsx',
  'index.html',
  'public/fonts.css',
  'src/views/Prospectos.tsx',
  'src/views/Ficha.tsx',
  'src/views/Pipeline.tsx',
  'src/views/Seguimientos.tsx',
  'src/views/Borradores.tsx',
];

function fromMain(path: string): string {
  return execSync(`git show main:${path}`, { encoding: 'utf8' });
}

function classTokens(source: string): string[] {
  const raw = [...source.matchAll(/className=(?:"([^"]+)"|'([^']+)')/g)].map((match) => match[1] || match[2]).join(' ');
  return [...new Set(raw.split(/\s+/).filter(Boolean))].sort();
}

describe('la interfaz aprobada no cambia de diseño', () => {
  it('conserva estilos, navegación y vistas que no necesitaban texto de cálculo', () => {
    for (const path of unchanged) {
      expect(readFileSync(path, 'utf8')).toBe(fromMain(path));
    }
  });

  it('Hoy, Criterios e Ingresos no introducen clases nuevas', () => {
    for (const path of ['src/views/Hoy.tsx', 'src/views/Criterios.tsx', 'src/views/Ingresos.tsx']) {
      const before = new Set(classTokens(fromMain(path)));
      for (const token of classTokens(readFileSync(path, 'utf8'))) expect(before.has(token)).toBe(true);
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
