import type { Activity } from '@/api/types';

export type OnboardingStep = 'cash' | 'products' | 'parties' | 'recap';

/** Ce que l'assistant de démarrage demande, selon le type d'activité : une
 * boutique a de la marchandise, un salaire non. Les mots s'adaptent aussi
 * (clients/fournisseurs, locataires, acheteurs…). */
export interface OnboardingPlan {
  steps: OnboardingStep[];
  labels: Record<OnboardingStep, string>;
  cashHint: string;
  productsTitle: string;
  partiesTitle: string;
  partiesHint: string;
  owesMe: string;
  iOwe: string;
}

const DEBTS_BY_DEFAULT: Activity['type'][] = ['commerce', 'service', 'rental', 'farming'];

export function onboardingPlan(act: Pick<Activity, 'type' | 'has_inventory' | 'has_debts'>): OnboardingPlan {
  const withProducts = act.type === 'commerce' || act.has_inventory;
  const withParties = act.has_debts || DEBTS_BY_DEFAULT.includes(act.type);
  const steps: OnboardingStep[] = ['cash', ...(withProducts ? ['products' as const] : []), ...(withParties ? ['parties' as const] : []), 'recap'];
  const words = PARTY_WORDS[act.type] ?? PARTY_WORDS.other;
  return {
    steps,
    labels: {
      cash: 'Mon argent',
      products: act.type === 'commerce' ? 'Ma marchandise' : 'Mon stock',
      parties: 'Dettes',
      recap: 'Récapitulatif',
    },
    cashHint:
      act.type === 'commerce'
        ? "Compte l'argent du tiroir, regarde le solde de ton compte et de ton mobile money."
        : 'Compte ton argent liquide, regarde le solde de ton compte et de ton mobile money.',
    productsTitle:
      act.type === 'commerce'
        ? "Quelle marchandise as-tu déjà en stock ?"
        : act.type === 'farming'
          ? 'Qu’as-tu déjà en stock (récoltes, bêtes, semences, engrais…) ?'
          : 'Qu’as-tu déjà en stock ?',
    ...words,
  };
}

const PARTY_WORDS: Record<string, Pick<OnboardingPlan, 'partiesTitle' | 'partiesHint' | 'owesMe' | 'iOwe'>> = {
  commerce: {
    partiesTitle: "Qui te doit de l'argent, à qui en dois-tu ?",
    partiesHint: "Les clients qui ont pris à crédit et les fournisseurs pas encore payés, aujourd'hui.",
    owesMe: 'Nom du client',
    iOwe: 'Nom du fournisseur',
  },
  service: {
    partiesTitle: "Qui te doit de l'argent, à qui en dois-tu ?",
    partiesHint: "Les clients qui n'ont pas encore payé ton travail, et ce que tu dois (matériel, sous-traitant…).",
    owesMe: 'Nom du client',
    iOwe: 'À qui tu dois',
  },
  rental: {
    partiesTitle: 'Loyers en retard et dettes',
    partiesHint: "Les locataires en retard de paiement, et ce que tu dois (travaux, propriétaire…), aujourd'hui.",
    owesMe: 'Nom du locataire',
    iOwe: 'À qui tu dois',
  },
  farming: {
    partiesTitle: "Qui te doit de l'argent, à qui en dois-tu ?",
    partiesHint: "Les acheteurs pas encore payés, et ce que tu dois (semences, engrais, ouvriers…), aujourd'hui.",
    owesMe: "Nom de l'acheteur",
    iOwe: 'Nom du fournisseur',
  },
  other: {
    partiesTitle: "Qui te doit de l'argent, à qui en dois-tu ?",
    partiesHint: "Les personnes qui te doivent de l'argent, et celles à qui tu en dois, aujourd'hui.",
    owesMe: 'Nom de la personne',
    iOwe: 'Nom de la personne',
  },
};
