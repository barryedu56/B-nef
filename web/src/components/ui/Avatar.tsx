interface AvatarProps {
  url?: string | null;
  name?: string;
  size?: number;
}

/** Photo de profil, ou à défaut les initiales du nom sur fond de couleur —
 * jamais un simple rond vide. */
export function Avatar({ url, name, size = 28 }: AvatarProps) {
  const initial = (name ?? '?').trim().charAt(0).toUpperCase() || '?';
  const style = { width: size, height: size, borderRadius: '999px', flexShrink: 0 };

  if (url) {
    return <img src={url} alt={name ? `Photo de ${name}` : 'Photo de profil'} style={{ ...style, objectFit: 'cover' }} />;
  }
  return (
    <div
      style={{
        ...style,
        background: 'var(--accent)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.42,
        fontWeight: 700,
      }}>
      {initial}
    </div>
  );
}
