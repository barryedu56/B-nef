# Gestion Finance — Mobile (Expo / React Native)

App mobile consommant l'API Django. Écrans : connexion/inscription, mes activités,
tableau de bord par activité (jour/semaine/mois/année), entrée/sortie d'argent,
vente (multi-produits, met le stock à jour), produits & stock (+ réappro),
activité & modules, vue globale (patrimoine + bascule de devise d'affichage),
réglages du compte.

## Prérequis

- Node.js 20+ (testé avec Node 24)
- L'API backend qui tourne (voir `../backend/README.md`)
- L'app [Expo Go](https://expo.dev/go) sur ton téléphone pour tester sans build native

## Installation

```powershell
cd mobile
npm install
copy .env.example .env
```

Édite `.env` : remplace l'IP par celle de ton PC (`ipconfig` → "Adresse IPv4",
celle du Wi-Fi). **`localhost` ne fonctionne pas depuis un téléphone physique.**

Côté backend, démarre l'API sur toutes les interfaces réseau :

```powershell
cd ..\backend
.\.venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000
```

Puis :

```powershell
cd ..\mobile
npm run start
```

Scanne le QR code avec Expo Go (Android) ou l'appareil photo (iOS). Le
téléphone et le PC doivent être sur le **même réseau Wi-Fi**.

Autres cibles :
- `npm run android` — émulateur Android (adresse API : `10.0.2.2` au lieu de l'IP locale)
- `npm run ios` — simulateur iOS (macOS uniquement)
- `npm run web` — dans le navigateur (`localhost` fonctionne ici)

## Vérifier que ça compile

```powershell
npm run typecheck
```

## Structure

```
src/
├── app/                     écrans (expo-router, routage par fichiers)
│   ├── login.tsx  register.tsx
│   ├── (tabs)/               Activités · Vue globale · Réglages
│   └── activity/[id]/        tableau de bord, opération, vente, produits, réglages
├── api/                      un module par ressource + client HTTP (JWT, rafraîchissement auto)
├── hooks/                    React Query (cache, invalidations)
├── components/ui/            kit d'interface (Bouton, Carte, Sélecteur, Champ…)
├── context/AuthContext.tsx   session (connexion/inscription/déconnexion)
├── lib/money.ts              formatage des montants par devise
├── lib/dates.ts               formatage des dates (français)
└── theme/                    couleurs, espacements, tailles (mêmes que les maquettes)
```

## Multi-devises

- Le tableau de bord d'une activité affiche toujours **la devise propre de
  l'activité** (pas de conversion silencieuse).
- L'onglet **Vue globale** propose de basculer entre GNF / XOF / USD / EUR —
  le choix est sauvegardé (`devise d'affichage` du compte) et la conversion se
  fait automatiquement via l'API (`/reports/global/?currency=…`).

## Limites connues (MVP)

- Mode clair uniquement — le style visuel définitif viendra après validation des maquettes.
- Catégories et moyens de paiement par défaut seulement (pas encore d'écran pour les gérer).
- Module Budget pas encore d'écran dédié (le modèle et l'API existent côté backend).
- Pas de mode hors-ligne.
