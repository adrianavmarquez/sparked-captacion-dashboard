import { readFileSync } from 'node:fs';

const token = process.env.SPARKED_OPERATOR_TOKEN?.trim();
const base = (process.env.SPARKED_API_BASE ?? 'https://sparked-captacion.netlify.app').replace(/\/$/, '');
const file = process.argv[2] ?? 'data/imports/charlotte-2026-11-15.json';

if (!token) {
  console.error('Falta SPARKED_OPERATOR_TOKEN en el entorno. No está en el repositorio.');
  process.exit(1);
}

const body = readFileSync(file);
const response = await fetch(`${base}/api/import/prospects`, {
  method: 'POST',
  headers: {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  },
  body,
});
const text = (await response.text()).split(token).join('[redacted]');
console.log(response.status);
console.log(text);
if (!response.ok) process.exit(1);
