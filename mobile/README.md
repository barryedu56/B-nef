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
├── offline/                  mode hors-ligne (file d'attente, synchro, cache, préchargement)
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

## Mode hors-ligne

L'app reste utilisable sans réseau :

- **Consultation** : les données déjà téléchargées sont gardées sur le
  téléphone 14 jours (`offline/queryClient.ts`). À la connexion et à chaque
  retour du réseau, l'app précharge activités, produits, tiers, moyens de
  paiement et dernières opérations (`offline/prefetch.ts`) — on peut donc
  vendre hors-ligne même dans une boutique jamais ouverte avant.
- **Saisie** : vente, entrée/sortie d'argent, réappro, consommation perso,
  ajustement de stock, règlement, annulation, nouveau tiers, nouveau produit.
  Sans réseau, l'opération part dans une file d'attente (`offline/outbox.ts`)
  et l'écran se met à jour tout de suite (stock, liste « en attente d'envoi »).
  Les chiffres du tableau de bord, eux, sont recalculés par le serveur à la
  synchronisation.
- **Synchronisation** (`offline/sync.ts`) : automatique au retour du réseau,
  au retour au premier plan et chaque minute, dans l'ordre de saisie. Chaque
  opération porte une `Idempotency-Key` : renvoyée deux fois (réponse perdue),
  elle n'est enregistrée qu'une fois. Un tiers ou produit créé hors-ligne a un
  numéro provisoire négatif, remplacé par le vrai à la synchro.
- Une vente faite hors-ligne est acceptée même si le stock enregistré ne
  suffit plus (`recorded_offline`) : elle a réellement eu lieu.
- Une opération refusée par le serveur reste visible dans **Synchronisation**
  (bandeau en haut des écrans) avec le motif : réessayer ou supprimer.
- Restent en ligne uniquement : créer/modifier une activité, réglages du
  compte, photo de profil, modifier une opération existante.
- Les jetons de connexion sont dans le trousseau chiffré du téléphone
  (`expo-secure-store`). À la déconnexion, tout ce qui concerne le compte est
  effacé du téléphone.

## Limites connues (MVP)

- Mode clair uniquement — le style visuel définitif viendra après validation des maquettes.
- Catégories et moyens de paiement par défaut seulement (pas encore d'écran pour les gérer).
- Module Budget pas encore d'écran dédié (le modèle et l'API existent côté backend).
