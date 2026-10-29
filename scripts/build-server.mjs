import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';

const output = 'desktop/app/backend';
await mkdir(output, { recursive: true });
await build({
  entryPoints: ['server/app.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: output + '/server.cjs',
  external: ['express', 'ws'],
  sourcemap: false,
  minify: true
});
console.log('Bundled CamBridge backend to ' + output + '/server.cjs');
