import { existsSync } from 'node:fs';
import path from 'node:path';
import { startServer } from './app';

const webRoot = path.resolve('dist');
startServer(Number(process.env.PORT || 8787), existsSync(path.join(webRoot, 'index.html')) ? webRoot : undefined);
