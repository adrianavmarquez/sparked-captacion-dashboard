export type AppAccess = 'checking' | 'locked' | 'live' | 'demo';

/** Sin sesión no hay demo, salvo un build explícito de demostración. */
export function resolveAccess(input: { demoBuild: boolean; authenticated: boolean }): Exclude<AppAccess, 'checking'> {
  if (input.authenticated) return 'live';
  if (input.demoBuild) return 'demo';
  return 'locked';
}
