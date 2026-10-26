import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors, fontSize, radius, shadow, spacing, touchable } from '@/theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  icon?: ComponentProps<typeof Ionicons>['name'];
}

export function Button({ label, onPress, variant = 'primary', disabled, loading, fullWidth = true, style, icon }: ButtonProps) {
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
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={18} color={labelStyle(variant).color} /> : null}
          <Text style={[styles.label, labelStyle(variant)]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

function variantStyle(variant: Variant): ViewStyle {
  switch (variant) {
    case 'secondary':
      return { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.borderStrong };
    case 'danger':
      return { backgroundColor: colors.card, borderWidth: 1.5, borderColor: '#f1b5b5' };
    case 'ghost':
      return { backgroundColor: 'transparent' };
    default:
      return { backgroundColor: colors.accent, ...shadow.accent };
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
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: fontSize.md, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
});
