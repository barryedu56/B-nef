// Génère les fichiers icônes/splash/favicon réels du logo "Bénef" (B barré +
// médaillon), en réutilisant exactement le même balisage/CSS que le canevas
// de design validé (Main.dc.html, colonne 3) — juste remis à l'échelle pour
// chaque résolution requise. Rendu via Playwright (Chromium headless) pour
// une fidélité pixel-perfect sans dépendre d'un outil de rasterisation SVG.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGES_DIR = path.join(__dirname, 'pages');
const OUT_DIR = path.join(__dirname, 'out');
mkdirSync(PAGES_DIR, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

const INDIGO = '#4f46e5';
const FONT_LINK =
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@800&display=swap">';

// Ratio de police tiré tel quel de Main.dc.html (colonne 3, boîte de référence 180px) :
//   police B : 104/180 — inchangé, c'est la taille de lettre approuvée.
//
// La barre du mockup original (58/180 de large) est corrigée ici : mesurée au
// rendu, la largeur réelle de la lettre "B" en IBM Plex Sans 800 occupe
// ~0.778 × la taille de police (140px de large pour 180px de police) — donc
// une barre à 58/180 restait entièrement À L'INTÉRIEUR du trait de la lettre
// (blanc sur blanc, invisible), et le signe « barré » ne se voyait pas du
// tout à l'écran malgré le nom de la variante. Ici la barre est volontai-
// rement plus large que la lettre pour dépasser des deux côtés, comme sur un
// vrai symbole monétaire (€, ₩, ₺…).
const fontRatio = 104 / 180;
const R = {
  font: fontRatio,
  barW: 0.95 * fontRatio,
  barH: 0.15 * fontRatio,
  barR: 0.214 * 0.15 * fontRatio,
};

function glyphHTML({ box, container = box, bg, transparent = false, ring = true, bar = true, letter = true }) {
  const font = R.font * container;
  const barW = R.barW * container;
  const barH = R.barH * container;
  const barR = R.barR * container;
  const ringSvg = ring
    ? `<svg width="${container}" height="${container}" viewBox="0 0 100 100" fill="none" style="position:absolute;inset:0;margin:auto">
         <circle cx="50" cy="50" r="38" stroke="#ffffff" stroke-opacity="0.45" stroke-width="3"/>
       </svg>`
    : '';
  const barDiv = bar
    ? `<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:${barW}px;height:${barH}px;background:#ffffff;border-radius:${barR}px"></div>`
    : '';
  const letterSpan = letter ? `<span class="b">B</span>` : '';
  return `<!doctype html>
<html><head><meta charset="utf-8">${FONT_LINK}
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:${box}px;height:${box}px;background:${transparent ? 'transparent' : bg}}
  .stage{width:${box}px;height:${box}px;display:flex;align-items:center;justify-content:center;position:relative}
  .glyph{width:${container}px;height:${container}px;position:relative;display:flex;align-items:center;justify-content:center}
  .b{position:relative;font-family:'IBM Plex Sans',sans-serif;font-weight:800;font-size:${font}px;color:#ffffff;line-height:1}
</style>
</head>
<body>
  <div class="stage">
    <div class="glyph">
      ${ringSvg}
      ${letterSpan}
      ${barDiv}
    </div>
  </div>
</body></html>`;
}

function tileHTML({ box, radius, container }) {
  const font = R.font * container;
  const barW = R.barW * container;
  const barH = R.barH * container;
  const barR = R.barR * container;
  return `<!doctype html>
<html><head><meta charset="utf-8">${FONT_LINK}
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:${box}px;height:${box}px;background:transparent}
  .tile{width:${box}px;height:${box}px;border-radius:${radius}px;background:${INDIGO};display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
  .glyph{width:${container}px;height:${container}px;position:relative;display:flex;align-items:center;justify-content:center}
  .b{position:relative;font-family:'IBM Plex Sans',sans-serif;font-weight:800;font-size:${font}px;color:#ffffff;line-height:1}
</style>
</head>
<body>
  <div class="tile" id="tile">
    <div class="glyph">
      <svg width="${container}" height="${container}" viewBox="0 0 100 100" fill="none" style="position:absolute;inset:0;margin:auto">
        <circle cx="50" cy="50" r="38" stroke="#ffffff" stroke-opacity="0.45" stroke-width="3"/>
      </svg>
      <span class="b">B</span>
      <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:${barW}px;height:${barH}px;background:#ffffff;border-radius:${barR}px"></div>
    </div>
  </div>
</body></html>`;
}

const specs = [
  // icône plate (1024x1024, fond plein, sans coins pré-arrondis — l'OS applique son propre masque)
  { name: 'icon-flat', box: 1024, html: glyphHTML({ box: 1024, bg: INDIGO }), transparent: false },
  // Android adaptive icon — fond seul (couleur plate, aucun glyphe : celui-ci vit
  // uniquement sur la couche foreground, sans quoi les deux couches superposées le dupliqueraient)
  { name: 'adaptive-background', box: 1024, html: glyphHTML({ box: 1024, bg: INDIGO, ring: false, bar: false, letter: false }), transparent: false },
  // Android adaptive icon — premier plan : glyphe dans une zone de sécurité ~62.5% (< 66% recommandé)
  { name: 'adaptive-foreground', box: 1024, html: glyphHTML({ box: 1024, container: 640, transparent: true }), transparent: true },
  // splash : glyphe blanc seul, sans fond, sur canevas 512
  { name: 'splash-glyph', box: 512, html: glyphHTML({ box: 512, transparent: true }), transparent: true },
  // favicon : mini-tuile arrondie (même rayon proportionnel que le mockup validé : 40/180)
  { name: 'favicon-tile', box: 512, html: tileHTML({ box: 512, radius: (40 / 180) * 512, container: (180 / 180) * 512 }), transparent: true },
];

for (const s of specs) {
  writeFileSync(path.join(PAGES_DIR, `${s.name}.html`), s.html, 'utf8');
}

const run = async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const s of specs) {
    await page.setViewportSize({ width: s.box, height: s.box });
    await page.goto(`file://${path.join(PAGES_DIR, `${s.name}.html`)}`);
    await page.evaluate(() => document.fonts.ready);
    // petite marge de sécurité pour le rendu de la police web
    await page.waitForTimeout(150);
    await page.screenshot({
      path: path.join(OUT_DIR, `${s.name}.png`),
      omitBackground: s.transparent,
    });
    console.log(`✓ ${s.name}.png (${s.box}x${s.box}, transparent=${s.transparent})`);
  }
  await browser.close();
};

run()
  .then(() => {
    // le monochrome Android réutilise exactement le même art (silhouette blanche sur transparent)
    copyFileSync(path.join(OUT_DIR, 'adaptive-foreground.png'), path.join(OUT_DIR, 'adaptive-monochrome.png'));
    console.log('✓ adaptive-monochrome.png (copie de adaptive-foreground.png)');
    console.log('\nTerminé.');
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
