import type { Activity } from '@/api/types';

/** Les mots du tableau de bord selon l'activité : « bénéfice » et « chiffre
 * d'affaires » parlent à un commerçant, pas à quelqu'un qui suit son salaire
 * ou les dépenses de la maison. */
export function activityWords(type: Activity['type'] | undefined) {
  const personal = type === 'household' || type === 'salary';
  return {
    personal,
    result: personal ? 'Ce qui te reste sur la période' : 'Bénéfice net de la période',
    resultShort: personal ? 'Ce qui te reste' : 'Bénéfice net',
    income: personal ? 'Entrées' : "Chiffre d'affaires",
    chart: personal ? 'Ce qui reste, mois par mois' : 'Évolution du bénéfice',
    expenses: personal ? 'Dépenses' : 'Charges',
    startTotal: personal ? 'Ton argent au départ' : 'Ce que vaut ton affaire',
    startNote: personal
      ? "Ce n'est ni une entrée ni une dépense : c'est ce que tu avais avant Bénef."
      : "Rien de tout ça ne compte dans ton bénéfice : ce sont tes affaires d'avant Bénef.",
  };
}

/** Accueil : mots « personnels » seulement si toutes les activités le sont. */
export function homeWords(activities: Pick<Activity, 'type'>[] | undefined) {
  const personal = !!activities?.length && activities.every((a) => activityWords(a.type).personal);
  return activityWords(personal ? 'household' : 'commerce');
}
