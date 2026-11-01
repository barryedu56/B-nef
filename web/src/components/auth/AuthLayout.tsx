import { ChartColumn, ChevronRight, PiggyBank, ShieldCheck, Smartphone, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';

const FEATURES = [
  { icon: ChartColumn, text: 'Ton bénéfice réel, par jour, semaine, mois et année' },
  { icon: PiggyBank, text: 'Stock, dettes et budgets suivis automatiquement' },
  { icon: WifiOff, text: 'Fonctionne même sans internet sur ton téléphone' },
  { icon: ShieldCheck, text: 'Tes données restent privées et chiffrées' },
];

/** Téléphone ou tablette : la version téléphone (installable, hors ligne)
 * convient mieux que cette version ordinateur. */
const ON_PHONE =
  typeof navigator !== 'undefined' &&
  (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1));

/** Écran partagé des pages d'accès : panneau de marque à gauche (caché sur
 * petit écran), formulaire à droite. */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="auth-split">
      <aside className="auth-brand" aria-hidden="true">
        <div className="auth-logo">
          <img src="/logo.png" alt="" />
          Bénef
        </div>
        <div className="auth-pitch">
          <h2>Gère ton argent comme un pro, simplement.</h2>
          <p>Boutique, champ, taxi, salaire ou maison : enregistre ce que tu fais, Bénef calcule ce que tu gagnes.</p>
          <ul className="auth-features">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text}>
                <span>
                  <Icon size={17} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <div className="auth-brand-footer">© {new Date().getFullYear()} Bénef</div>
      </aside>
      <main className="auth-panel">
        <div className="auth-card">
          <div className="auth-mobile-logo">
            <img src="/logo.png" alt="" />
            Bénef
          </div>
          {ON_PHONE ? (
            <a className="phone-version" href="/app/">
              <Smartphone size={20} />
              <span style={{ flex: 1 }}>
                <strong>Sur téléphone, utilise la version mobile</strong>
                <br />
                Plus pratique, installable sur l'écran d'accueil et utilisable sans internet.
              </span>
              <ChevronRight size={18} />
            </a>
          ) : null}
          <div>
            <h1 className="auth-title">{title}</h1>
            {subtitle ? <p className="auth-subtitle">{subtitle}</p> : null}
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
