# Image de production de l'API (voir DEPLOIEMENT.md).
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# collectstatic n'a besoin d'aucune base : réglages factices le temps du build.
RUN DJANGO_SECRET_KEY=build DB_ENGINE=sqlite python manage.py collectstatic --noinput \
    && useradd --create-home --uid 1000 benef \
    && mkdir -p /app/media && chown -R benef /app/media

USER benef
EXPOSE 8000

# Migrations appliquées à chaque démarrage (sans effet si déjà à jour).
CMD ["sh", "-c", "python manage.py migrate --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers ${GUNICORN_WORKERS:-3} --timeout 60 --access-logfile -"]
