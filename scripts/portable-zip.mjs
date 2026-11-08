import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

mkdirSync('/opt/cursor/artifacts', { recursive: true });
const out = '/opt/cursor/artifacts/sparked-backend-source.zip';
execFileSync('git', [
  'archive', '--format=zip', '-o', out, 'HEAD',
], { stdio: 'inherit' });
console.log(out);
