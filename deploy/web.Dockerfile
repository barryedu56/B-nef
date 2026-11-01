# Construit les deux interfaces web puis les sert avec Caddy, qui fait aussi
# le HTTPS automatique (Let's Encrypt) et le relais vers l'API :
#   https://<domaine>/      -> app web (ordinateur, dossier web/)
#   https://<domaine>/app/  -> app téléphone installable (PWA, dossier mobile/),
#                              pour les iPhone tant qu'il n'y a pas d'App Store
FROM node:22-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
# Même domaine que l'API : chemin relatif.
ENV VITE_API_URL=/api
RUN npm run build

FROM node:22-alpine AS mobile
WORKDIR /mobile
COPY mobile/package.json mobile/package-lock.json ./
RUN npm ci
COPY mobile/ ./
ENV EXPO_PUBLIC_API_URL=/api \
    BENEF_WEB_BASE_URL=/app \
    EXPO_NO_TELEMETRY=1
RUN npx expo export --platform web --output-dir dist

FROM caddy:2.10-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=web /web/dist /srv/web
COPY --from=mobile /mobile/dist /srv/mobile/app
