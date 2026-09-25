import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { colors, fontSize, radius, spacing, touchable } from '@/theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function Button({ label, onPress, variant = 'primary', disabled, loading, fullWidth = true, style }: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variantStyle(variant),
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' || variant === 'ghost' ? colors.accent : colors.white} />
      ) : (
        <Text style={[styles.label, labelStyle(variant)]}>{label}</Text>
      )}
    </Pressable>
  );
}

function variantStyle(variant: Variant): ViewStyle {
  switch (variant) {
    case 'secondary':
      return { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderStrong };
    case 'danger':
      return { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.negative };
    case 'ghost':
      return { backgroundColor: 'transparent' };
    default:
      return { backgroundColor: colors.accent };
  }
}

function labelStyle(variant: Variant) {
  if (variant === 'primary') return { color: colors.white };
  if (variant === 'danger') return { color: colors.negative };
  if (variant === 'ghost') return { color: colors.accent };
  return { color: colors.textPrimary };
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchable.minHeight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: { width: '100%' },
  label: { fontSize: fontSize.md, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
});
