import { Image, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme';

interface AvatarProps {
  url?: string | null;
  name?: string;
  size?: number;
}

/** Photo de profil, ou à défaut les initiales du nom sur fond de couleur —
 * jamais un simple rond vide. */
export function Avatar({ url, name, size = 28 }: AvatarProps) {
  const initial = (name ?? '?').trim().charAt(0).toUpperCase() || '?';
  const dimension = { width: size, height: size, borderRadius: size / 2 };

  if (url) {
    return <Image source={{ uri: url }} style={[styles.image, dimension]} />;
  }
  return (
    <View style={[styles.fallback, dimension]}>
      <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: colors.placeholder },
  fallback: { backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  initial: { color: colors.white, fontWeight: '700' },
});
