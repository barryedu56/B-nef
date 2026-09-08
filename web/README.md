# Gestion Finance — Web (React / Vite)

Poste d'analyse consommant l'API Django : tableau de bord consolidé, compte de
résultat exportable, gestion des activités / transactions / inventaire / tiers,
et le même sélecteur de devise (GNF/XOF/USD/EUR) qu'en mobile.

## Prérequis

- Node.js 20+
- L'API backend qui tourne (voir `../backend/README.md`)

## Installation

```powershell
cd web
npm install
copy .env.example .env.local
```

`localhost` fonctionne tel quel (le navigateur tourne sur le même PC que
l'API). Puis :

```powershell
npm run dev
```

Ouvre http://localhost:5173.

## Vérifier que ça compile

```powershell
npm run typecheck   # tsc -b
npm run build        # tsc -b + build de production (dist/)
```

## Pages

| Route | Contenu |
|---|---|
| `/` | Tableau de bord consolidé (KPI, évolution, résultat par activité, alertes de stock, créances, dernières transactions) |
| `/activities` · `/activities/:id` | Liste des activités · tableau de bord d'une activité (modules, opérations, ventes) |
| `/transactions` | Table filtrable (activité, sens) de toutes les transactions |
| `/inventory` | Produits & stock par activité, réapprovisionnement |
| `/parties` | Tiers, créances / dettes |
| `/reports` | Compte de résultat (par activité ou consolidé, par période) + export PDF (impression navigateur) |
| `/settings` | Devise principale / d'affichage, déconnexion |

## Structure

```
src/
├── App.tsx                  routes (react-router)
├── api/                      un module par ressource + client HTTP (JWT, rafraîchissement auto)
├── hooks/                    React Query
├── components/
│   ├── layout/                AppLayout (barre latérale), PageHeader
│   ├── ui/                    Bouton, Carte, Champ, Modale, Segmented…
│   ├── PartyPicker.tsx         sélection / création rapide de tiers
│   ├── NewTransactionModal.tsx
│   ├── NewSaleModal.tsx
│   └── RestockModal.tsx
├── pages/                     un fichier par page
├── context/AuthContext.tsx
├── lib/money.ts · lib/dates.ts
└── styles/global.css          jetons de design (mêmes couleurs que les maquettes)
```

## Limites connues (MVP)

- Export PDF via l'impression du navigateur (pas de génération PDF côté serveur).
- Catégories et moyens de paiement par défaut seulement (pas d'écran de gestion).
- Module Budget pas encore d'écran dédié.
- Les créances/dettes individuelles et les lignes de transaction restent
  affichées dans la devise principale réelle, pas reconverties comme les
  agrégats du tableau de bord (pour rester honnête sur ce qui est vraiment converti).
