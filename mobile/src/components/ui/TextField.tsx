import { StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { colors, fontSize, radius, spacing } from '@/theme';

interface TextFieldProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  error?: string;
  editable?: boolean;
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
  editable = true,
}: TextFieldProps) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        keyboardType={keyboardType}
        multiline={multiline}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        editable={editable}
        style={[styles.input, multiline && styles.multiline, !!error && styles.inputError, !editable && styles.inputDisabled]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '500' },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    backgroundColor: colors.card,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  inputError: { borderColor: colors.negative },
  inputDisabled: { backgroundColor: colors.bg, color: colors.textTertiary },
  error: { fontSize: fontSize.xs, color: colors.negative },
});
