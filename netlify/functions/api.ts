import { createDefaultDeps } from '../../server/api/deps';
import { handleApi } from '../../server/api/handler';
import { netlifyEnv } from '../../server/env';

export default async (req: Request) => {
  return handleApi(req, createDefaultDeps(netlifyEnv()));
};

export const config = {
  path: '/api/*',
};
