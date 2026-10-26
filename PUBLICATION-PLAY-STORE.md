# Publier Bénef sur le Play Store

Tout ce qui peut être préparé sans payer l'est déjà : identifiant Android,
configuration de compilation, icône, bannière, politique de confidentialité,
suppression de compte, compte de démonstration, textes de la fiche. Ce guide
liste ce qu'il reste à faire, dans l'ordre.

> Les règles de Google changent souvent. Les points marqués *(à vérifier)*
> sont à contrôler dans la Console Play au moment de publier.

## 0. Avant de commencer

| À faire | Où |
|---|---|
| Le serveur est en ligne avec un nom de domaine (voir [DEPLOIEMENT.md](DEPLOIEMENT.md)) | — |
| Remplacer `VOTRE-DOMAINE` par le vrai domaine (2 endroits) | [`mobile/eas.json`](mobile/eas.json) |
| Compléter l'e-mail de contact et l'éditeur | [`web/src/legal.ts`](web/src/legal.ts) |
| Vérifier que ces pages s'affichent : `https://<domaine>/confidentialite` et `https://<domaine>/suppression-compte` | navigateur |
| Créer le compte de démonstration sur le serveur | voir ci-dessous |

```bash
cd B-nef/deploy
docker compose exec backend python manage.py create_demo --password "UnMotDePasseLongEtSolide"
```

L'identifiant de l'app est **`com.ahmadbarry.benef`** ([`mobile/app.json`](mobile/app.json)).
Il ne pourra plus jamais changer une fois la première version envoyée :
modifie-le avant si tu préfères un autre nom.

## 1. Les comptes

1. **Google Play Console** : [play.google.com/console](https://play.google.com/console),
   25 $ une seule fois, avec vérification d'identité.
2. **Expo** (gratuit) : [expo.dev](https://expo.dev). Il construit l'app dans le
   cloud, sans Android Studio.

## 2. Construire l'app

```bash
npm install -g eas-cli
eas login
cd B-nef/mobile
eas build --platform android --profile preview      # APK à installer sur ton téléphone pour tester
eas build --platform android --profile production   # fichier .aab à envoyer au Play Store
```

Expo crée et garde la **clé de signature** de l'app : ne la supprime jamais de
ton compte Expo, sinon tu ne pourras plus publier de mise à jour.

Pour chaque mise à jour : augmente `version` (ex. `1.0.1`) et `android.versionCode`
(`2`, `3`…) dans `mobile/app.json`, puis relance le build `production`.

## 3. Créer l'app dans la Console Play

**Créer une application** → nom `Bénef`, langue par défaut **Français**, type
**Application**, **Gratuite**.

### Fiche Play Store

| Champ | Texte |
|---|---|
| Nom (30 car. max) | `Bénef – Gestion & bénéfice` |
| Description courte (80 car. max) | `Ventes, dépenses, stock et dettes : connais ton vrai bénéfice, même hors-ligne.` |
| Icône 512×512 | [`docs/play-store/icone-512.png`](docs/play-store/icone-512.png) |
| Bannière 1024×500 | [`docs/play-store/banniere-1024x500.png`](docs/play-store/banniere-1024x500.png) |
| Captures d'écran | au moins 2, prises sur ton téléphone avec le compte démo (tableau de bord, vente, stock, vue globale) |
| Catégorie | **Finance** |

**Description complète :**

```
Bénef t'aide à savoir combien tu gagnes vraiment — par jour, par semaine, par mois et par année.

Commerçant, artisan, agriculteur, taxi, salarié ou simplement pour les dépenses de la maison : crée une activité pour chaque chose que tu fais, et Bénef calcule ton bénéfice réel.

• Ventes en quelques secondes, avec mise à jour automatique du stock
• Stock et coût d'achat moyen : tu sais ce que vaut ta marchandise
• Dépenses par catégorie et budgets avec alertes avant de trop dépenser
• Crédits et dettes : qui te doit, à qui tu dois, règlements partiels
• Plusieurs activités, une vue globale : caisse, stock, créances, patrimoine
• Plusieurs devises (GNF, XOF, USD, EUR) avec conversion automatique
• Fonctionne sans internet : tes ventes partent dès que le réseau revient
• Export Excel pour ton comptable, rapport PDF
• Aussi sur ordinateur, avec les mêmes données

Tes données t'appartiennent : jamais vendues, pas de publicité, et tu peux supprimer ton compte à tout moment.
```

### Contenu de l'application (menu « Règles et programmes »)

| Rubrique | Réponse |
|---|---|
| Politique de confidentialité | `https://<domaine>/confidentialite` |
| Accès à l'application | « Certaines fonctionnalités nécessitent une connexion » → identifiant `demo` + le mot de passe choisi pour `create_demo` |
| Annonces | **Non**, l'app ne contient pas de publicité |
| Classification du contenu | Questionnaire : catégorie « Utilitaire, productivité… », répondre **Non** partout (pas de violence, de jeux d'argent, etc.) |
| Public cible | **18 ans et plus** (outil de gestion) |
| Application d'actualités | Non |
| Fonctionnalités financières *(à vérifier)* | Bénef ne prête pas d'argent, ne gère pas de paiement et n'est pas une banque : c'est un outil de suivi. Choisis l'option correspondant à « aucune de ces fonctionnalités » / suivi de finances personnelles |
| Suppression de compte | Oui : dans l'app (Réglages → Supprimer mon compte) et sur le web : `https://<domaine>/suppression-compte` |

### Sécurité des données

| Question | Réponse |
|---|---|
| L'app collecte-t-elle des données ? | **Oui** |
| Chiffrées pendant le transfert ? | **Oui** (HTTPS) |
| L'utilisateur peut-il demander la suppression ? | **Oui** |
| Données partagées avec des tiers ? | **Non** (l'hébergeur est un sous-traitant, pas un partage au sens de Google) |

Données collectées, toutes **pour le fonctionnement de l'app** et la **gestion du compte**, jamais pour la publicité :

| Type Google | Détail | Obligatoire ? |
|---|---|---|
| Informations personnelles → Adresse e-mail | récupération du mot de passe | oui |
| Informations personnelles → Identifiants utilisateur | nom d'utilisateur | oui |
| Informations personnelles → Numéro de téléphone | profil | facultatif |
| Informations financières → Autres informations financières | ventes, dépenses, stock, dettes saisis par l'utilisateur | oui |
| Photos et vidéos → Photos | photo de profil | facultatif |
| Infos sur l'appli et performances → Journaux de plantage | uniquement si le suivi d'erreurs (Sentry) est activé sur le serveur | — |

Les clients et fournisseurs saisis (nom, téléphone) entrent dans « Autres informations financières ».

## 4. Tests puis publication

1. **Test interne** (jusqu'à 100 personnes, sans examen) : envoie le `.aab`, ajoute
   ton adresse Gmail, installe depuis le lien et vérifie tout.
2. **Test fermé** *(à vérifier)* : pour un compte développeur **personnel** récent,
   Google exige en général **au moins 12 testeurs inscrits pendant 14 jours d'affilée**
   avant d'autoriser la production. Prévois 12 personnes (famille, amis, futurs clients)
   qui installent Bénef et l'utilisent pendant deux semaines.
3. **Production** : demande l'accès à la production, Google examine (quelques jours),
   puis l'app est publique.

## Plus tard : iPhone

App Store : 99 $ par an. Pas besoin de Mac : `eas build --platform ios`. L'identifiant
`com.ahmadbarry.benef` est déjà configuré.
