#!/usr/bin/env node
/* Après `expo export --platform web` : écrit dans dist/sw.js la liste des
 * fichiers de l'app à garder sur le téléphone dès la première visite, et un
 * numéro de version (le service worker se met à jour à chaque nouvelle
 * version de l'app). Sans ça, l'app n'était gardée qu'à la 2e ouverture et
 * pouvait rester blanche hors connexion.
 *
 *   node scripts/pwa-precache.js dist /app/
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const [dist = 'dist', scope = '/app/'] = process.argv.slice(2);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const files = walk(dist)
  .map((f) => path.relative(dist, f).split(path.sep).join('/'))
  .filter((f) => !['sw.js', 'metadata.json', 'index.html'].includes(f))
  // Seule la police Ionicons sert ; les autres polices d'icônes pèsent lourd.
  .filter((f) => !f.endsWith('.ttf') || path.basename(f).startsWith('Ionicons'))
  .sort();

const hash = crypto.createHash('sha256');
for (const f of files.concat('index.html')) hash.update(f).update(fs.readFileSync(path.join(dist, f)));
const version = hash.digest('hex').slice(0, 12);

const urls = [scope, ...files.map((f) => scope + f)];
const swPath = path.join(dist, 'sw.js');
const sw = fs.readFileSync(swPath, 'utf8');
if (!sw.includes('self.__BENEF_PRECACHE__')) throw new Error('sw.js : marqueur __BENEF_PRECACHE__ introuvable');
fs.writeFileSync(swPath, sw.replace('self.__BENEF_PRECACHE__', JSON.stringify({ version, urls })));
console.log(`sw.js : version ${version}, ${urls.length} fichiers gardés hors connexion`);
