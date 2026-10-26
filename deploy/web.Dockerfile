# Construit l'app web (Vite) puis la sert avec Caddy, qui fait aussi le
# HTTPS automatique (Let's Encrypt) et le relais vers l'API.
FROM node:22-alpine AS build
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
# Même domaine que l'API : chemin relatif.
ENV VITE_API_URL=/api
RUN npm run build

FROM caddy:2.10-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /web/dist /srv/web
