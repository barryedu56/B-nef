import { ChartColumn, PiggyBank, ShieldCheck, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';

const FEATURES = [
  { icon: ChartColumn, text: 'Ton bénéfice réel, par jour, semaine, mois et année' },
  { icon: PiggyBank, text: 'Stock, dettes et budgets suivis automatiquement' },
  { icon: WifiOff, text: 'Fonctionne même sans internet sur ton téléphone' },
  { icon: ShieldCheck, text: 'Tes données restent privées et chiffrées' },
];

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
