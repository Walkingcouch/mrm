// Copies the pdf.js runtime into public/pdf-viewer so the viewer is served
// from our own domain (no third-party CDN). Runs on postinstall.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = dirname(require.resolve('pdfjs-dist/package.json'));
const out = new URL('../public/pdf-viewer/lib/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
for (const f of ['build/pdf.min.mjs', 'build/pdf.worker.min.mjs']) copyFileSync(join(root, f), join(out, f.split('/').pop()));
console.log('pdf.js copied to public/pdf-viewer/lib');
