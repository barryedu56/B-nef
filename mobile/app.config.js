// Réglages de app.json, plus l'adresse de la version web installable (PWA) :
// en production elle est servie sous /app/ (voir deploy/web.Dockerfile).
// Sans BENEF_WEB_BASE_URL (développement, builds Android/iOS), rien ne change.
module.exports = ({ config }) => {
  const baseUrl = process.env.BENEF_WEB_BASE_URL;
  return baseUrl ? { ...config, experiments: { ...config.experiments, baseUrl } } : config;
};
