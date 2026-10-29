import { cp, mkdir } from 'node:fs/promises';

await mkdir('desktop/app', { recursive: true });
await cp('dist', 'desktop/app', { recursive: true });
console.log('Prepared browser assets in desktop/app');
