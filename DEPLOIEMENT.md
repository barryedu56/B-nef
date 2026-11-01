# Déploiement de Bénef sur un serveur

Tout tourne dans Docker sur **un seul serveur** (VPS) :

| Service | Rôle |
|---|---|
| `db` | PostgreSQL 16 — les données clients. Jamais exposée sur Internet. |
| `backend` | API Django (gunicorn). Applique les migrations à chaque démarrage. |
| `web` | Caddy : sert l'app web (ordinateur) à la racine et l'app téléphone installable sous `/app/` (iPhone), relaie `/api` et l'administration vers le backend, **HTTPS automatique** (Let's Encrypt). |
| `scheduler` | Une fois par jour : taux de change (`fetch_rates`) + ménage des clés de rejeu. |
| `backup` | Sauvegarde PostgreSQL chaque nuit vers `deploy/backups/` (14 jours gardés). |

## 1. Le serveur

- Un VPS Linux (Ubuntu 24.04) : **2 Go de RAM, 2 vCPU, 40 Go de disque** suffisent
  largement pour démarrer (Hetzner, OVH, DigitalOcean, Contabo…).
- Un nom de domaine, avec un enregistrement DNS **A** qui pointe vers l'IP du
  serveur (ex. `app.benef.gn`).

Sécurité de base, une seule fois :

```bash
# Connexion par clé SSH uniquement, puis :
sudo apt update && sudo apt upgrade -y
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
sudo apt install -y unattended-upgrades   # mises à jour de sécurité automatiques
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER             # puis se reconnecter
```

## 2. Installer Bénef

```bash
git clone git@github.com:barryedu56/B-nef.git
cd B-nef/deploy
cp .env.example .env
nano .env        # domaine, clé secrète, mot de passe de la base, SMTP
docker compose up -d --build
docker compose exec backend python manage.py createsuperuser
```

Ouvre `https://<ton-domaine>` : l'app web s'affiche, le certificat HTTPS est
obtenu tout seul en quelques secondes.

Avant le premier démarrage, tu peux vérifier la configuration de Caddy :

```bash
docker compose run --rm web caddy validate --config /etc/caddy/Caddyfile
```

Les adresses une fois en ligne :

| Adresse | Pour qui |
|---|---|
| `https://<domaine>/` | App web, sur ordinateur |
| `https://<domaine>/app/` | App téléphone dans le navigateur — **les utilisateurs d'iPhone** l'installent depuis Safari |
| `https://<domaine>/<BENEF_ADMIN_PATH>/` | **Ton administration** (voir plus bas) |
| Play Store | App Android (voir PUBLICATION-PLAY-STORE.md) |

## 3. Ton administration

Le compte créé avec `createsuperuser` (étape 2) te donne accès à
`https://<domaine>/<BENEF_ADMIN_PATH>/` (`/admin/` si tu n'as rien changé
dans `deploy/.env` — mieux vaut choisir un mot connu de toi seul).

- **Tableau de bord** : nombre d'utilisateurs, inscrits de la semaine et du
  mois, utilisateurs actifs, opérations saisies, dernières inscriptions.
- **Utilisateurs** : nombre d'activités et d'opérations de chacun, dernière
  connexion ; actions « Désactiver » (ne peut plus se connecter, données
  gardées) et « Réactiver ».
- **Opérations, mouvements de stock, lignes de vente, vérifications de
  caisse** : consultation seulement (les modifier à la main fausserait les
  soldes ; les corrections se font dans l'app).
- **Taux de change** : tu peux en ajouter un s'il en manque.
- 10 mots de passe faux de suite bloquent la connexion 15 minutes.

Mot de passe long et unique, et ne crée pas d'autre compte « staff » sans raison.

## 4. Te connecter à la base de données

La base PostgreSQL n'est **pas** ouverte sur Internet : elle n'écoute que sur
le serveur lui-même (`127.0.0.1:5432`).

**En ligne de commande, sur le serveur :**

```bash
cd ~/B-nef/deploy
docker compose exec db psql -U benef benef
# ex. : \dt  (liste des tables)   SELECT count(*) FROM accounts_user;   \q pour quitter
```

**Avec un logiciel graphique sur ton PC** (DBeaver, gratuit, ou pgAdmin) via
un tunnel SSH chiffré :

```bash
ssh -N -L 5433:127.0.0.1:5432 <utilisateur>@<ip-du-serveur>
```

Laisse cette fenêtre ouverte, puis dans DBeaver : nouvelle connexion
PostgreSQL, hôte `localhost`, port `5433`, base `benef`, utilisateur `benef`,
mot de passe = `DB_PASSWORD` de `deploy/.env`. (DBeaver sait aussi créer le
tunnel lui-même : onglet « SSH » de la connexion.)

Prudence : une modification directe en base contourne toutes les règles de
l'app (soldes, stock). Lis autant que tu veux, n'écris qu'en connaissance de
cause, et fais une sauvegarde avant.

**En local (développement)**, la base est le fichier `backend/db.sqlite3`
(`DB_ENGINE=sqlite` dans `backend/.env`) : ouvre-le avec DBeaver (connexion
« SQLite ») ou « DB Browser for SQLite ». L'administration locale est sur
`http://localhost:8000/admin/` après `python manage.py createsuperuser`.

## 5. Les utilisateurs d'iPhone (sans App Store)

En attendant un compte Apple Developer, les utilisateurs d'iPhone utilisent
**l'app téléphone dans Safari**, à l'adresse `https://<domaine>/app/` :

1. Ouvrir l'adresse dans **Safari** (pas Chrome).
2. Toucher **Partager** (carré avec une flèche) puis **« Sur l'écran d'accueil »**.
3. Bénef apparaît avec son icône et s'ouvre en plein écran, comme une app.

C'est la même app que sur Android : même compte, mêmes données, et elle
**fonctionne sans internet** (les saisies partent au retour du réseau).
Différences avec une vraie app : pas de rappel sur le téléphone pour les
dépenses fixes (la bannière de l'accueil reste), et l'installation se fait
à la main (l'app l'explique elle-même dans Safari). L'app web ouverte sur un
téléphone propose aussi un lien vers cette version.

## 6. L'app mobile

Dans `mobile/.env` :

```
EXPO_PUBLIC_API_URL=https://<ton-domaine>/api
```

puis reconstruis l'app (`eas build`) pour la distribuer.

## 7. Mettre à jour

```bash
cd B-nef && git pull
cd deploy && docker compose up -d --build
```

## 8. Sauvegardes — à lire

Les dumps quotidiens sont dans `deploy/backups/`. **Ils sont sur le même
serveur que la base** : si le serveur disparaît, ils disparaissent avec. Copie-les
ailleurs chaque jour, par exemple avec [rclone](https://rclone.org) vers un
stockage objet (Backblaze B2, Scaleway, Google Drive) :

```bash
# crontab -e
30 3 * * * rclone copy ~/B-nef/deploy/backups distant:benef-backups --max-age 48h
```

Restaurer une sauvegarde :

```bash
docker compose exec -T db pg_restore -U benef -d benef --clean --if-exists < backups/benef-AAAA-MM-JJ_HHMM.dump
```

Teste une restauration de temps en temps : une sauvegarde jamais restaurée
n'est pas une sauvegarde.

## 9. Surveiller

```bash
docker compose ps                 # tout doit être "running" / "healthy"
docker compose logs -f backend    # erreurs de l'API
docker compose logs backup        # "Sauvegarde OK" chaque nuit
```

Pour être alerté des erreurs sans lire les logs : crée un projet gratuit sur
sentry.io et mets son DSN dans `SENTRY_DSN`.
