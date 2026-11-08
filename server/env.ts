export interface Env {
  get(name: string): string | undefined;
}

/** Vacío cuenta como ausente. Nunca registra el valor. */
export function readEnv(env: Env, name: string): string | undefined {
  const value = env.get(name)?.trim();
  return value ? value : undefined;
}

export function netlifyEnv(): Env {
  const host = globalThis as { Netlify?: { env?: { get(name: string): string | undefined } } };
  if (host.Netlify?.env) return { get: (name) => host.Netlify!.env!.get(name) };
  return { get: (name) => process.env[name] };
}
