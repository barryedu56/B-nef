#!/bin/sh
# Met les réglages d'envoi d'e-mails (Brevo) dans .env, redémarre l'API et
# envoie un e-mail d'essai. À lancer sur le serveur, de façon interactive :
# la clé est tapée sans s'afficher et n'apparaît jamais dans l'historique.
#   sh deploy/configurer-email.sh <identifiant>@smtp-brevo.com
set -eu
cd "$(dirname "$0")"

LOGIN="${1:?Indique l identifiant SMTP, ex. xxx@smtp-brevo.com}"

printf 'Colle la clé SMTP Brevo puis Entrée (rien ne s affiche) : '
stty -echo 2>/dev/null || true
IFS= read -r KEY
stty echo 2>/dev/null || true
echo
case "$KEY" in
  xsmtpsib-*) ;;
  *) echo "Ce n'est pas une clé SMTP Brevo (elle commence par xsmtpsib-). Rien n'a été changé."; exit 1 ;;
esac

printf 'Ton adresse e-mail pour recevoir l essai : '
IFS= read -r DEST
case "$DEST" in
  *@*.*) ;;
  *) echo "Adresse invalide. Rien n'a été changé."; exit 1 ;;
esac

umask 077
cp -p .env .env.avant-email
TMP=$(mktemp .env.XXXXXX)
grep -vE '^(DEFAULT_FROM_EMAIL|EMAIL_HOST|EMAIL_PORT|EMAIL_HOST_USER|EMAIL_HOST_PASSWORD|EMAIL_USE_TLS)=' .env > "$TMP" || true
{
  echo "DEFAULT_FROM_EMAIL='Bénef <noreply@monbenef.com>'"
  echo "EMAIL_HOST=smtp-relay.brevo.com"
  echo "EMAIL_PORT=587"
  echo "EMAIL_HOST_USER=$LOGIN"
  echo "EMAIL_HOST_PASSWORD=$KEY"
  echo "EMAIL_USE_TLS=True"
} >> "$TMP"
cat "$TMP" > .env
rm -f "$TMP"
KEY=

echo "Redémarrage de l'API…"
docker compose up -d --no-build --no-deps --force-recreate backend scheduler >/dev/null 2>&1
sleep 10

echo "Envoi de l'e-mail d'essai…"
if docker compose exec -T -e DEST="$DEST" backend python manage.py shell -c "
import os
from django.core.mail import send_mail
send_mail('Bénef : e-mail d essai', 'Si tu lis ce message, l envoi des e-mails de Bénef fonctionne.', None, [os.environ['DEST']])
" >/dev/null 2>.email-erreur; then
  rm -f .env.avant-email .email-erreur
  echo "OK : e-mail d'essai envoyé à $DEST. Regarde ta boîte (et les spams)."
else
  tail -n 1 .email-erreur | sed 's/xsmtpsib-[^ ]*/[clé masquée]/g'
  rm -f .email-erreur
  mv .env.avant-email .env
  docker compose up -d --no-build --no-deps --force-recreate backend scheduler >/dev/null 2>&1
  echo "ÉCHEC : l'envoi n'a pas marché. Les anciens réglages sont remis."
  exit 1
fi
