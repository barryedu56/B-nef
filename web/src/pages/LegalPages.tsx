import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { LEGAL } from '@/legal';

function LegalShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="auth-shell" style={{ alignItems: 'flex-start' }}>
      <article className="auth-card legal" style={{ maxWidth: 720, gap: 14, lineHeight: 1.6, fontSize: 14 }}>
        <div>
          <h1 className="auth-title">{title}</h1>
          <p className="auth-subtitle">
            {LEGAL.appName} · mise à jour le {LEGAL.updatedOn}
          </p>
        </div>
        {children}
        <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>
          <Link to="/confidentialite">Confidentialité</Link> · <Link to="/suppression-compte">Supprimer son compte</Link> ·{' '}
          <Link to="/login">Se connecter</Link>
        </p>
      </article>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <LegalShell title="Politique de confidentialité">
      <p>
        {LEGAL.appName} est un outil de suivi financier : chacun y enregistre ses activités (boutique, salaire,
        champ, dépenses du foyer…) pour connaître son bénéfice réel. Cette page explique quelles données sont
        collectées, pourquoi, et comment les supprimer. Éditeur : {LEGAL.publisher} — contact :{' '}
        <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.
      </p>

      <h2>Données collectées</h2>
      <ul>
        <li>
          <strong>Compte</strong> : nom d'utilisateur, mot de passe (stocké chiffré, jamais lisible), adresse
          e-mail (pour récupérer le mot de passe), et si tu les ajoutes : numéro de téléphone, photo de profil.
        </li>
        <li>
          <strong>Ce que tu saisis</strong> : activités, entrées et sorties d'argent, ventes, produits et stock,
          budgets, et tes clients / fournisseurs (nom, téléphone, dettes et créances).
        </li>
        <li>
          <strong>Données techniques</strong> : journaux du serveur (adresse IP, date, erreurs) gardés pour la
          sécurité et le dépannage. Aucune géolocalisation, aucun contact du téléphone, aucun traceur publicitaire.
        </li>
      </ul>

      <h2>Pourquoi</h2>
      <p>
        Uniquement pour faire fonctionner l'application : calculer tes chiffres, les synchroniser entre ton
        téléphone et le web, t'envoyer un code si tu oublies ton mot de passe. Tes données ne sont{' '}
        <strong>jamais vendues</strong> ni utilisées pour de la publicité.
      </p>

      <h2>Qui y a accès</h2>
      <p>
        Toi seul, avec ton compte. Les données sont hébergées chez {LEGAL.host}. Les e-mails (code de mot de
        passe) passent par un prestataire d'envoi d'e-mails. En cas d'erreur technique, un rapport sans données
        personnelles peut être envoyé à un service de suivi d'erreurs.
      </p>

      <h2>Sécurité</h2>
      <ul>
        <li>Connexion chiffrée (HTTPS) entre l'application et le serveur.</li>
        <li>Mots de passe chiffrés ; sur le téléphone, la session est rangée dans le trousseau sécurisé.</li>
        <li>
          Pour travailler sans réseau, l'app garde une copie de tes données sur le téléphone ; elle est effacée
          quand tu te déconnectes.
        </li>
      </ul>

      <h2>Les données de tes clients et fournisseurs</h2>
      <p>
        Quand tu enregistres un client ou un fournisseur (nom, téléphone), tu en es responsable : n'enregistre que
        ce qui est utile à ton activité, avec l'accord des personnes concernées.
      </p>

      <h2>Durée de conservation et suppression</h2>
      <p>
        Tes données sont gardées tant que ton compte existe. Tu peux à tout moment{' '}
        <Link to="/suppression-compte">supprimer ton compte</Link> : tout est effacé immédiatement, et disparaît
        des sauvegardes au plus tard {LEGAL.backupRetentionDays} jours après.
      </p>

      <h2>Tes droits</h2>
      <p>
        Tu peux consulter et corriger tes données dans l'application, les exporter (Rapports → Export Excel), et
        les supprimer. Pour toute question : <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.
      </p>
    </LegalShell>
  );
}

export function DeleteAccountInfoPage() {
  return (
    <LegalShell title="Supprimer son compte Bénef">
      <p>
        La suppression est <strong>définitive</strong> : ton compte et toutes ses données (activités, opérations,
        stock, clients et fournisseurs, budgets) sont effacés immédiatement, puis des sauvegardes au plus tard{' '}
        {LEGAL.backupRetentionDays} jours après. Pense à exporter tes chiffres avant si tu veux les garder.
      </p>
      <h2>Depuis l'application mobile</h2>
      <ol>
        <li>Onglet Réglages.</li>
        <li>« Supprimer mon compte », tout en bas.</li>
        <li>Confirme avec ton mot de passe.</li>
      </ol>
      <h2>Depuis le site</h2>
      <ol>
        <li>
          <Link to="/login">Connecte-toi</Link>, puis va dans Paramètres.
        </li>
        <li>« Supprimer mon compte », confirme avec ton mot de passe.</li>
      </ol>
      <h2>Tu n'as plus accès à ton compte ?</h2>
      <p>
        Écris à <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a> depuis l'adresse e-mail
        enregistrée sur le compte, en indiquant ton nom d'utilisateur. La suppression est faite sous 7 jours.
      </p>
    </LegalShell>
  );
}
