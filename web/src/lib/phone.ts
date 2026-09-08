// Numéros mobiles guinéens : 9 chiffres, préfixe 61/62 (Orange), 65
// (Cellcom) ou 66 (MTN) — plan de numérotation ARPT. Voir aussi
// backend/apps/common/phone.py (même règle, autorité finale côté serveur).
const GUINEA_PHONE_RE = /^(61|62|65|66)\d{7}$/

export function normalizeGuineaPhone(value: string): string {
  return value.replace(/\D/g, '')
}

export function isValidGuineaPhone(value: string): boolean {
  return GUINEA_PHONE_RE.test(value)
}
