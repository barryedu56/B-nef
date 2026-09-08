"""
Configuration Django — projet Gestion Finance.

Les valeurs sensibles / spécifiques à la machine sont lues depuis un fichier .env
(voir .env.example). Sous WAMP, MySQL écoute en général sur 127.0.0.1:3306,
utilisateur "root" sans mot de passe.
"""
from pathlib import Path

from dotenv import load_dotenv
import os

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def env(key, default=None):
    return os.environ.get(key, default)


def env_bool(key, default=False):
    return str(env(key, default)).lower() in {"1", "true", "yes", "on"}


def env_list(key, default=""):
    raw = env(key, default) or ""
    return [item.strip() for item in raw.split(",") if item.strip()]


# --- Base -------------------------------------------------------------------
SECRET_KEY = env("DJANGO_SECRET_KEY", "dev-insecure-change-me")
DEBUG = env_bool("DJANGO_DEBUG", True)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,0.0.0.0")

# --- Applications ----------------------------------------------------------
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
]

LOCAL_APPS = [
    "apps.common",
    "apps.accounts",
    "apps.currencies",
    "apps.activities",
    "apps.finance",
    "apps.inventory",
    "apps.contacts",
    "apps.budget",
    "apps.reports",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# --- Base de données -----------------------------------------------------
# DB_ENGINE = "sqlite" pour un démarrage rapide sans MySQL.
if env("DB_ENGINE", "mysql") == "sqlite":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.mysql",
            "NAME": env("DB_NAME", "gestion_finance"),
            "USER": env("DB_USER", "root"),
            "PASSWORD": env("DB_PASSWORD", ""),
            "HOST": env("DB_HOST", "127.0.0.1"),
            "PORT": env("DB_PORT", "3306"),
            "OPTIONS": {
                "charset": "utf8mb4",
                # default_storage_engine forcé ici, PAS seulement dans le
                # my.ini du serveur : WAMP peut revenir à MyISAM (rechargement
                # de config, changement de version MySQL...) sans prévenir, ce
                # qui rendrait de nouvelles tables silencieusement
                # non-transactionnelles (déjà arrivé une fois sur ce projet).
                # Un réglage par connexion Django ne dépend plus de ça.
                "init_command": "SET sql_mode='STRICT_TRANS_TABLES', default_storage_engine=InnoDB",
            },
        }
    }

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# --- International -------------------------------------------------------
LANGUAGE_CODE = "fr"
TIME_ZONE = env("DJANGO_TIME_ZONE", "Africa/Conakry")
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Fichiers utilisateur (photos de profil, etc.). Servis par Django lui-même
# en dev (voir config/urls.py) ; en prod, un vrai serveur de fichiers/CDN
# devant MEDIA_ROOT est recommandé.
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

# Django refuse par défaut tout corps de requête > 2.5 Mo (avant même
# d'atteindre le serializer) — trop bas pour une photo de profil envoyée
# depuis un téléphone (AvatarUploadSerializer accepte jusqu'à 5 Mo). Sans ça,
# une photo entre 2.5 et 5 Mo casse la connexion en plein transfert au lieu
# de renvoyer une erreur propre, ce qui ressemble à tort à un problème réseau
# côté client ("impossible de joindre le serveur").
DATA_UPLOAD_MAX_MEMORY_SIZE = 8 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 8 * 1024 * 1024

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- DRF ----------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.OrderingFilter",
        "rest_framework.filters.SearchFilter",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
    # Limitation de débit sur les endpoints sensibles uniquement (voir
    # apps/common/throttling.py) — pas de throttle générique sur toute
    # l'API pour ne pas gêner un usage normal (React Query, etc.).
    "DEFAULT_THROTTLE_RATES": {
        "login": "10/min",
        "register": "10/hour",
        "password_reset": "5/hour",
    },
}

from datetime import timedelta  # noqa: E402

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=12),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=30),
    "ROTATE_REFRESH_TOKENS": True,
    # Un refresh token remplacé par rotation est désormais révoqué pour de
    # vrai (table token_blacklist) — sans ça, un token volé restait valable
    # jusqu'à 30 jours même après qu'un nouveau ait été émis.
    "BLACKLIST_AFTER_ROTATION": True,
}

# --- CORS (apps mobile Expo + web Vite) -------------------------------
CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:8081,http://localhost:19006",
)
CORS_ALLOW_CREDENTIALS = True
# Sans ça, le JS du navigateur ne peut PAS lire ce header sur une réponse
# cross-origin (Vite:5173 -> Django:8000 sont deux origines différentes) —
# nécessaire pour récupérer le nom de fichier du PDF de rapport téléchargé.
CORS_EXPOSE_HEADERS = ["Content-Disposition"]

# --- Métier -----------------------------------------------------------
DEFAULT_BASE_CURRENCY = env("DEFAULT_BASE_CURRENCY", "GNF")
# Source des taux de change : API gratuite, sans clé, qui couvre le GNF et le XOF.
EXCHANGE_RATE_SOURCES = [
    "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/{base}.json",
    "https://latest.currency-api.pages.dev/v1/currencies/{base}.json",
]
EXCHANGE_RATE_MAX_AGE_HOURS = int(env("EXCHANGE_RATE_MAX_AGE_HOURS", "36"))

# --- E-mail (mot de passe oublié) -----------------------------------
# Sans EMAIL_HOST configuré : les e-mails s'affichent dans la console
# `runserver` au lieu d'être vraiment envoyés (pratique en dev / WAMP).
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", "no-reply@gestion-finance.local")
if env("EMAIL_HOST"):
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_HOST = env("EMAIL_HOST")
    EMAIL_PORT = int(env("EMAIL_PORT", "587"))
    EMAIL_HOST_USER = env("EMAIL_HOST_USER", "")
    EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", "")
    EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", True)
else:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# --- Sécurité HTTPS/cookies (prod uniquement) --------------------------
# Tout ça casserait le dev local en http:// (redirection HTTPS, cookies
# "Secure" invisibles en clair) — activé automatiquement dès que DEBUG=False,
# donc uniquement une fois vraiment déployé (voir DJANGO_DEBUG dans .env).
if not DEBUG:
    SECURE_SSL_REDIRECT = env_bool("DJANGO_SECURE_SSL_REDIRECT", True)
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 60 * 60 * 24 * 30  # 30 jours, monte progressivement en confiance
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    # Derrière un proxy/reverse-proxy (nginx, Railway, Render...) qui termine
    # le TLS et transmet en HTTP en interne — sans ça Django croit que
    # chaque requête est en clair et boucle sur SECURE_SSL_REDIRECT.
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    CSRF_TRUSTED_ORIGINS = env_list("DJANGO_CSRF_TRUSTED_ORIGINS")

# --- Logs ---------------------------------------------------------------
# Sans ça, une erreur serveur en production (DEBUG=False) ne laisse aucune
# trace exploitable. En dev, Django affiche déjà les erreurs dans la
# console de `runserver` par défaut — ce réglage le rend explicite partout.
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        "django": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "django.request": {"handlers": ["console"], "level": "ERROR", "propagate": False},
    },
}

# --- Suivi d'erreurs (optionnel) ----------------------------------------
# Renseigne SENTRY_DSN en prod pour être alerté des erreurs serveur en
# temps réel au lieu de devoir lire des logs à la main. Sans ça : rien ne
# change, l'app tourne normalement (juste sans alerte).
SENTRY_DSN = env("SENTRY_DSN")
if SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[DjangoIntegration()],
        traces_sample_rate=0.1,
        send_default_pii=False,
    )
