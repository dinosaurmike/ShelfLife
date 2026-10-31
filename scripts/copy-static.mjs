// After `vite build`: copies the files the app loads at run time by their own paths (not through
// Vite) into dist/, so dist/ is a complete site to upload.
import { cpSync, existsSync } from 'node:fs';

const files = ['manifest.json', 'sw.js', '_redirects', 'hershey.js', 'qrcode.js', 'privacy.html', 'clear_cache.html'];
const folders = ['libs', 'icons'];
for (const f of files) if (existsSync(f)) cpSync(f, `dist/${f}`);
for (const d of folders) if (existsSync(d)) cpSync(d, `dist/${d}`, { recursive: true });
console.log('Copied static files into dist/');
