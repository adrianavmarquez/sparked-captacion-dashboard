import type { IncomingMessage, ServerResponse } from 'node:http';
import { createDefaultDeps } from '../api/deps';
import { handleApi } from '../api/handler';

/** Solo el servidor de desarrollo de Vite. No entra en el bundle del navegador. */
export async function handleNodeRequest(req: IncomingMessage, res: ServerResponse) {
  const host = req.headers.host ?? 'localhost';
  const url = new URL(req.url ?? '/api', `http://${host}`);
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null) continue;
    headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }
  const request = new Request(url, {
    method: req.method,
    headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
  });
  const response = await handleApi(request, createDefaultDeps({ get: (name) => process.env[name] }));
  res.statusCode = response.status;
  response.headers.forEach((value, key) => { res.setHeader(key, value); });
  res.end(Buffer.from(await response.arrayBuffer()));
}
