// Neon Shore — a GTA VI style cover maker, built for make.fun.
// Entry: "Neon Shore" turns photos into Vice City poster covers:
// four multi-panel layouts, four sunset and neon colour grades,
// bold Anton titles with a Pacifico subtitle, exported as PNG.
// This program hands the entry in: it copies app/ and screenshots/
// into the output directory and writes dossier.json with the kit's
// buildDossier library, so the dossier is byte for byte the library's.

import { buildDossier } from './vendor/makefun-app.ts';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
const appSrc = join(repoRoot, 'app');
const shotsSrc = join(repoRoot, 'screenshots');
const dossierPath = join(outDir, 'dossier.json');

if (!existsSync(appSrc)) throw new Error('Neon Shore: app/ is missing from the repository');
if (!existsSync(shotsSrc)) throw new Error('Neon Shore: screenshots/ is missing from the repository');

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(appSrc, join(outDir, 'app'), { recursive: true });
cpSync(shotsSrc, join(outDir, 'screenshots'), { recursive: true });

const dossier = await buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
});
writeFileSync(dossierPath, dossier);

const dossierJson = JSON.parse(new TextDecoder().decode(dossier));
console.log(`Neon Shore: ${dossierJson.images.length} screenshots, dossier ${dossier.byteLength} bytes -> ${dossierPath}`);
