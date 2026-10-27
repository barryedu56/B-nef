# Logo Bénef

Une pièce blanche avec trois barres qui montent (la dernière en vert : le
gain), sur un dégradé indigo → violet (#4f46e5 → #7c3aed).

Sources vectorielles (toutes les images PNG de l'app en sont tirées) :

| Fichier | Sert à |
|---|---|
| `benef-icon.svg` | icône carrée pleine : `mobile/assets/images/icon.png` (iOS, Expo), `docs/play-store/icone-512.png` — le téléphone arrondit lui-même les coins |
| `benef-logo.svg` | logo aux coins arrondis : `web/public/logo.png`, `favicon.png`, `favicon.svg`, `mobile/assets/images/favicon.png` |
| `benef-android-foreground.svg` / `-background.svg` / `-monochrome.svg` | icône adaptative Android (le premier plan reste dans la zone sûre) |
| `benef-splash.svg` | écran de démarrage (fond indigo défini dans `mobile/app.json`) |

Pour régénérer un PNG : ouvrir le SVG dans un navigateur (ou Inkscape) et
l'exporter à la taille du fichier remplacé (1024 px pour les icônes, 512 px
pour le favicon et l'écran de démarrage).
