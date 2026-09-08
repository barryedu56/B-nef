# Gestion Finance — Backend (Django + DRF)

API REST pour le suivi financier multi-activités avec inventaire et **multi-devises**
(devise principale GNF par défaut, conversion automatique via une API de taux gratuite).

## Prérequis

- Python 3.12+ (testé sur 3.14)
- WAMP (MySQL) — ou rien du tout pour démarrer en SQLite

## Installation

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env      # puis adapte .env
```

### Option A — démarrage rapide (SQLite)

Dans `.env` : `DB_ENGINE=sqlite`

```powershell
python manage.py migrate
python manage.py fetch_rates          # télécharge les taux de change du jour
python manage.py createsuperuser
python manage.py runserver
```

### Option B — MySQL via WAMP

1. Démarre WAMP, ouvre **phpMyAdmin**, crée une base `gestion_finance`
   (interclassement `utf8mb4_unicode_ci`).
2. Dans `.env` :
   ```
   DB_ENGINE=mysql
   DB_NAME=gestion_finance
   DB_USER=root
   DB_PASSWORD=
   DB_HOST=127.0.0.1
   DB_PORT=3306
   ```
3. `python manage.py migrate` puis `fetch_rates`, `createsuperuser`, `runserver`.

> Le connecteur MySQL est **PyMySQL** (pur Python, aucune compilation) — pas besoin
> d'installer `mysqlclient`.

⚠️ **WampServer configure MySQL en MyISAM par défaut** (`default_storage_engine=MYISAM`
dans `wamp64\bin\mysql\<version>\my.ini`), un moteur qui **ne supporte pas les
transactions** — sans InnoDB, une opération qui échoue à mi-chemin (ex. une vente
qui touche à la fois le stock et la caisse) peut laisser des données à moitié
écrites au lieu d'annuler proprement, et les codes correcteurs de cette app
(annulation d'une vente/d'un achat, `atomic()`) ne fonctionnent pas du tout.
**Avant de mettre de vraies données**, vérifie que les tables sont en InnoDB :
```sql
SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE();
```
Si ça affiche `MyISAM` : dans `my.ini`, commente `default_storage_engine=MYISAM` et
décommente `default_storage_engine=InnoDB`, redémarre MySQL depuis l'icône WAMP,
puis convertis les tables existantes :
```sql
ALTER TABLE nom_de_la_table ENGINE=InnoDB;  -- pour chaque table listée ci-dessus
```
(déjà fait sur l'installation actuelle au moment d'écrire ceci.)

## Taux de change

`python manage.py fetch_rates` récupère les taux du jour depuis
[@fawazahmed0/currency-api](https://github.com/fawazahmed0/exchange-api)
(gratuit, sans clé, couvre GNF, XOF, USD, EUR…) et les stocke dans `ExchangeRate`.

À planifier **une fois par jour** :
- Windows : Planificateur de tâches → action
  `...\.venv\Scripts\python.exe ...\manage.py fetch_rates`
- ou cron / Celery beat en production.

Principe de conversion :
- chaque transaction stocke son montant dans 3 devises (saisie / activité /
  principale), figées au taux de sa date → l'historique ne bouge pas ;
- l'affichage dans une autre devise (`?currency=USD`) reconvertit les totaux
  au **taux le plus récent**.

## Mot de passe oublié

Sans `EMAIL_HOST` configuré dans `.env`, le code de réinitialisation à 6
chiffres s'affiche directement dans la console `runserver` (backend de mail
"console" de Django) au lieu d'être envoyé par e-mail — pratique en dev. Pour
un vrai envoi, renseigne un compte SMTP (`EMAIL_HOST`, `EMAIL_HOST_USER`,
`EMAIL_HOST_PASSWORD`…) dans `.env`. Le code est valable 15 minutes, à usage
unique, et consultable aussi dans `/admin/` (modèle *Codes de
réinitialisation*).

## Annulation d'une transaction (pas de suppression)

Principe comptable : une écriture ne se supprime jamais, elle s'**annule**
(`POST /transactions/<id>/void/`). L'historique reste consultable, mais une
transaction annulée sort de tous les calculs (rapports, trésorerie, soldes des
tiers). Le `DELETE` brut sur `/transactions/<id>/` est refusé (405).

Ce qui est réparé automatiquement selon le type :
- **Simple** : rien d'autre à faire, elle sort juste des calculs.
- **Vente** : le stock vendu est remis (toujours possible, ça ne touche jamais
  le coût moyen).
- **Réapprovisionnement** : le stock et le coût moyen sont restaurés — **mais
  seulement si c'est le dernier mouvement de stock du produit** ; sinon,
  annuler fausserait l'historique du coût moyen et c'est refusé (400) avec un
  message clair. Fais un ajustement de stock pour corriger dans ce cas.
- **Règlement** : l'opération d'origine redevient « non réglée ».

Une opération déjà réglée ne peut pas être annulée directement (annule
d'abord son règlement). Après création, seuls la catégorie, le moyen de
paiement, le tiers et la note restent modifiables (`PATCH`) — montant, devise,
sens et date ne changent jamais : on annule et on ressaisit.

## Points d'entrée de l'API (`/api/`)

| Méthode | URL | Rôle |
|---|---|---|
| POST | `auth/register/` | Inscription |
| POST | `auth/token/` · `auth/token/refresh/` | JWT |
| GET/PATCH | `auth/me/` | Profil (devise principale, devise d'affichage) |
| POST | `auth/password-reset/request/` | Envoie un code à 6 chiffres par e-mail (`{identifier}` = nom d'utilisateur ou e-mail) |
| POST | `auth/password-reset/confirm/` | `{identifier, code, new_password}` → change le mot de passe |
| CRUD | `activities/` | Activités + modules |
| CRUD | `categories/` `payment-methods/` | Référentiels |
| GET/PATCH | `transactions/` | Entrées / sorties (PATCH limité à catégorie/moyen de paiement/tiers/note — filtres : activity, direction, kind, party, is_credit, is_settled…) |
| POST | `transactions/<id>/void/` | Annule (`{reason?}`) — jamais de suppression, voir « Annulation » ci-dessous |
| POST | `transactions/<id>/settle/` | Enregistre le règlement d'une opération à crédit (`{amount?, payment_method?, occurred_on?, note?}`) |
| CRUD | `products/` (`?low_stock=1`) | Produits / stock |
| GET | `stock-movements/` `sale-lines/` | Historique |
| CRUD | `parties/` (`parties/totals/`) | Tiers, créances / dettes |
| CRUD | `budgets/` | Budgets |
| GET | `currencies/` `exchange-rates/` `exchange-rates/status/` | Devises & taux |
| GET | `convert/?amount=&from=&to=[&on=]` | Conversion ponctuelle |
| POST | `sales/` | Vente multi-produits (crée transaction + mouvements de stock) |
| POST | `purchases/` | Réapprovisionnement (recalcule le coût moyen) |
| POST | `stock-adjustments/` | Ajustement d'inventaire |
| GET | `reports/activity/<id>/?period=day\|week\|month\|year[&currency=]` | Compte de résultat d'une activité |
| GET | `reports/global/?period=…[&currency=]` | Vue globale consolidée + patrimoine |

Admin Django : `/admin/`.

## Tests rapides

```powershell
python scripts\smoke_test.py     # services métier
python scripts\smoke_api.py      # endpoints HTTP (transaction annulée à la fin)
```

## Déploiement en production (ouvert à d'autres utilisateurs)

Ce qui est déjà en place, activé automatiquement dès que `DJANGO_DEBUG=False` :
- HTTPS forcé + cookies `Secure` + HSTS (`config/settings.py`, bloc "Sécurité HTTPS/cookies").
- Limitation de débit sur connexion (10/min), inscription (10/h) et réinitialisation de mot de passe (5/h) — `apps/common/throttling.py`. Évite le brute-force du mot de passe ou du code de réinitialisation à 6 chiffres.
- Révocation réelle des refresh tokens JWT après rotation (`rest_framework_simplejwt.token_blacklist`) — un token remplacé ne reste plus valable jusqu'à 30 jours.
- Logs structurés (`LOGGING`) + suivi d'erreurs optionnel via Sentry (renseigne `SENTRY_DSN` dans `.env`, sinon aucun effet).
- Moteur InnoDB forcé **par connexion** (`DATABASES.OPTIONS.init_command`), indépendamment du réglage par défaut du serveur MySQL — évite qu'une nouvelle table parte silencieusement en MyISAM (non-transactionnel) si le serveur revient un jour à son défaut (déjà arrivé une fois avec WAMP).

Ce qu'il reste à faire avant d'ouvrir l'inscription publiquement (voir `.env.example`, section "Prod uniquement") :
1. Un vrai hébergement (VPS ou PaaS + base de données gérée) — `runserver`/WAMP ne sont pas faits pour tourner en continu.
2. Des sauvegardes automatiques de la base.
3. `DJANGO_ALLOWED_HOSTS` et `CORS_ALLOWED_ORIGINS` restreints au(x) vrai(s) domaine(s) (plus de `*`).
4. `DJANGO_CSRF_TRUSTED_ORIGINS` renseigné avec l'origine exacte du front.
5. Une politique de confidentialité / CGU si des données d'autres personnes sont hébergées.

## Structure

```
backend/
├── config/            settings, urls, wsgi/asgi
├── apps/
│   ├── common/        mixins, permissions
│   ├── accounts/      User (devise principale / d'affichage), JWT, catégories par défaut
│   ├── currencies/    Currency, ExchangeRate, conversion, commande fetch_rates
│   ├── activities/    Activity (+ modules inventaire / dettes / budget)
│   ├── finance/       Category, PaymentMethod, Transaction (+ snapshots de conversion)
│   ├── inventory/     Product, StockMovement, SaleLine (+ services vente / réappro)
│   ├── contacts/      Party (+ calcul créance / dette)
│   ├── budget/        Budget
│   └── reports/       agrégats (compte de résultat, trésorerie, vue globale)
└── scripts/           smoke tests
```
