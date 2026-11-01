import { ChartColumn, ChevronRight, ShieldCheck, Smartphone, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

const CHIPS = [
  { icon: ChartColumn, text: 'Ton bénéfice réel, chaque jour' },
  { icon: WifiOff, text: 'Marche sans internet sur téléphone' },
  { icon: ShieldCheck, text: 'Données privées et chiffrées' },
];

/** Téléphone ou tablette : la version téléphone (installable, hors ligne)
 * convient mieux que cette version ordinateur. */
const ON_PHONE =
  typeof navigator !== 'undefined' &&
  (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1));

/** Pages d'accès : logo, carte centrée sur un fond doux, atouts en pastilles
 * sous la carte. `wide` pour l'inscription (plus de champs). */
export function AuthLayout({
  title,
  subtitle,
  wide,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <main className={['auth-page', wide ? 'top' : ''].filter(Boolean).join(' ')}>
      <div className="auth-dots" aria-hidden="true" />
      <Link to="/login" className="auth-logo" aria-label="Bénef — connexion">
        <img src="/logo.png" alt="" />
        Bénef
      </Link>
      <div className={['auth-box', wide ? 'wide' : ''].filter(Boolean).join(' ')}>
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
        <div className="auth-box-head">
          <h1 className="auth-title">{title}</h1>
          {subtitle ? <p className="auth-subtitle">{subtitle}</p> : null}
        </div>
        {children}
      </div>
      <ul className="auth-chips">
        {CHIPS.map(({ icon: Icon, text }) => (
          <li key={text}>
            <Icon size={13} />
            {text}
          </li>
        ))}
      </ul>
      <p className="auth-bottom">
        © {new Date().getFullYear()} Bénef · <Link to="/confidentialite">Confidentialité</Link>
      </p>
    </main>
  );
}
