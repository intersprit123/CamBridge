import { cp, mkdir, readdir } from 'node:fs/promises';

await mkdir('desktop/app', { recursive: true });
for (const entry of await readdir('dist')) {
  await cp('dist/' + entry, 'desktop/app/' + entry, { recursive: true, force: true });
}
console.log('Prepared browser assets in desktop/app');
