# Déploiement de Bénef sur un serveur

Tout tourne dans Docker sur **un seul serveur** (VPS) :

| Service | Rôle |
|---|---|
| `db` | PostgreSQL 16 — les données clients. Jamais exposée sur Internet. |
| `backend` | API Django (gunicorn). Applique les migrations à chaque démarrage. |
| `web` | Caddy : sert l'app web, relaie `/api` vers le backend, **HTTPS automatique** (Let's Encrypt). |
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

## 3. L'app mobile

Dans `mobile/.env` :

```
EXPO_PUBLIC_API_URL=https://<ton-domaine>/api
```

puis reconstruis l'app (`eas build`) pour la distribuer.

## 4. Mettre à jour

```bash
cd B-nef && git pull
cd deploy && docker compose up -d --build
```

## 5. Sauvegardes — à lire

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

## 6. Surveiller

```bash
docker compose ps                 # tout doit être "running" / "healthy"
docker compose logs -f backend    # erreurs de l'API
docker compose logs backup        # "Sauvegarde OK" chaque nuit
```

Pour être alerté des erreurs sans lire les logs : crée un projet gratuit sur
sentry.io et mets son DSN dans `SENTRY_DSN`.
