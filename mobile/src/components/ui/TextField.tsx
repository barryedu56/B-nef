import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ComponentProps } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { colors, fontSize, radius, spacing } from '@/theme';

interface TextFieldProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  /** Champ mot de passe : masqué, avec un bouton œil pour l'afficher. */
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  error?: string;
  hint?: string;
  editable?: boolean;
  icon?: ComponentProps<typeof Ionicons>['name'];
  autoComplete?: ComponentProps<typeof TextInput>['autoComplete'];
  maxLength?: number;
  inputStyle?: ComponentProps<typeof TextInput>['style'];
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  secureTextEntry,
  autoCapitalize = 'sentences',
  error,
  hint,
  editable = true,
  icon,
  autoComplete,
  maxLength,
  inputStyle,
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.box,
          multiline && styles.multiline,
          focused && styles.boxFocused,
          !!error && styles.boxError,
          !editable && styles.boxDisabled,
        ]}>
        {icon ? <Ionicons name={icon} size={18} color={focused ? colors.accent : colors.textTertiary} /> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          keyboardType={keyboardType}
          multiline={multiline}
          secureTextEntry={secureTextEntry && !revealed}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          maxLength={maxLength}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={label ?? placeholder}
          style={[styles.input, multiline && styles.inputMultiline, inputStyle]}
        />
        {secureTextEntry ? (
          // Zone de taille fixe qui ne se rétrécit jamais : sur Android, le
          // champ texte (flex: 1) pouvait occuper toute la largeur et pousser
          // l'œil hors du cadre.
          <Pressable
            onPress={() => setRevealed((v) => !v)}
            hitSlop={8}
            style={styles.eye}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
            <Ionicons name={revealed ? 'eye-off-outline' : 'eye-outline'} size={21} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 7 },
  label: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '600' },
  box: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
  },
  boxFocused: { borderColor: colors.accent, backgroundColor: '#fbfbff' },
  boxError: { borderColor: colors.negative },
  boxDisabled: { backgroundColor: colors.bg },
  multiline: { minHeight: 88, alignItems: 'flex-start', paddingVertical: 10 },
  input: {
    flex: 1,
    // Sans ça, Android peut donner au champ sa largeur « naturelle » et
    // déborder sur ce qui le suit (l'œil du mot de passe).
    flexShrink: 1,
    minWidth: 0,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    paddingVertical: 12,
    // Version web : le cadre coloré du champ suffit, pas de contour navigateur en plus.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  eye: { width: 36, height: 36, flexShrink: 0, alignItems: 'center', justifyContent: 'center', marginRight: -6 },
  inputMultiline: { textAlignVertical: 'top', paddingVertical: 0 },
  error: { fontSize: fontSize.xs, color: colors.negative },
  hint: { fontSize: fontSize.xs, color: colors.textTertiary, lineHeight: 16 },
});
