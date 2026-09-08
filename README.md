# Gestion Finance — projet « Bénef »

Outil de suivi financier pour tout le monde (commerçant, salarié, agriculteur,
ménage, freelance…) : chacun fait « l'inventaire » de ce qu'il fait et connaît son
**bénéfice réel par jour, semaine, mois et année**.

> Nom de l'app choisi : **Bénef** (déjà utilisé dans les écrans de connexion, le
> titre de l'onglet web, l'icône mobile et les e-mails). Le dossier et la doc
> technique gardent le nom de code « Gestion Finance » pour l'instant — logo
> final à appliquer une fois choisi parmi les propositions.

## Le modèle

- **Activité** = tout ce qu'on fait qui touche à l'argent (une boutique, un salaire,
  un taxi, un champ, les dépenses de la maison).
- Chaque activité a des **revenus**, des **dépenses**, et des **modules** activables :
  - **Inventaire** : produits, stock, coût moyen pondéré, valeur du stock
  - **Crédits & dettes** : qui me doit / que dois-je
  - **Budget & prévision**
- **Vue globale** : consolidation de toutes les activités (revenu net total +
  patrimoine = caisse + valeur du stock + créances − dettes).
- **Multi-devises** : devise principale GNF, plus XOF, USD, EUR. L'utilisateur peut
  afficher ses chiffres dans une autre devise ; la conversion est automatique
  (taux téléchargés chaque jour, aucune saisie manuelle).

## Composants

| Dossier | Contenu | État |
|---|---|---|
| [`design/`](design/) | Maquettes low-fi (canvas) | ✅ validées |
| [`backend/`](backend/) | API Django + DRF + MySQL (WAMP) | ✅ fondations + tests OK |
| [`mobile/`](mobile/) | App React Native (Expo) | ✅ écrans principaux + typecheck/export OK |
| [`web/`](web/) | App React / Vite (poste d'analyse) | ✅ pages principales + typecheck/build OK |

Voir [`backend/README.md`](backend/README.md), [`mobile/README.md`](mobile/README.md) et [`web/README.md`](web/README.md) pour l'installation.

📖 **[Guide de l'application](GUIDE-UTILISATEUR.md)** — ce que veut dire chaque carte et chaque écran (utile si un chiffre comme « Charges » ou « Caisse » n'est pas clair).

## Stack

- **Backend** : Django 5.2, Django REST Framework, JWT, MySQL (PyMySQL), `requests`
- **Mobile** : React Native / Expo
- **Web** : React + Vite
- **Front (les deux)** : React Query
