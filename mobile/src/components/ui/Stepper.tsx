import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, fontSize, radius } from '@/theme';

interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export function Stepper({ value, onChange, min = 0, max, step = 1 }: StepperProps) {
  const canDecrement = value - step >= min;
  const canIncrement = max === undefined || value + step <= max;

  // Champ éditable au clavier en plus des boutons +/- (utile pour de grosses
  // quantités : taper "20" plutôt que taper + vingt fois).
  const [text, setText] = useState(formatValue(value));
  useEffect(() => {
    setText(formatValue(value));
  }, [value]);

  const commit = (raw: string) => {
    const normalized = raw.replace(',', '.').trim();
    const parsed = normalized === '' ? min : Number(normalized);
    if (Number.isNaN(parsed)) {
      setText(formatValue(value));
      return;
    }
    const clamped = Math.max(min, max !== undefined ? Math.min(max, parsed) : parsed);
    onChange(roundStep(clamped));
    setText(formatValue(clamped));
  };

  return (
    <View style={styles.row}>
      <Pressable
        disabled={!canDecrement}
        onPress={() => onChange(Math.max(min, roundStep(value - step)))}
        style={[styles.button, !canDecrement && styles.buttonDisabled]}>
        <Text style={[styles.buttonLabel, !canDecrement && styles.buttonLabelDisabled]}>−</Text>
      </Pressable>
      <TextInput
        value={text}
        onChangeText={setText}
        onEndEditing={(e) => commit(e.nativeEvent.text)}
        onBlur={() => commit(text)}
        keyboardType="numeric"
        selectTextOnFocus
        style={styles.value}
      />
      <Pressable
        disabled={!canIncrement}
        onPress={() => onChange(max !== undefined ? Math.min(max, roundStep(value + step)) : roundStep(value + step))}
        style={[styles.button, styles.buttonPrimary, !canIncrement && styles.buttonDisabled]}>
        <Text style={[styles.buttonLabel, styles.buttonLabelPrimary]}>+</Text>
      </Pressable>
    </View>
  );
}

function roundStep(n: number) {
  return Math.round(n * 1000) / 1000;
}

function formatValue(n: number) {
  return String(roundStep(n));
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  button: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
  buttonDisabled: { opacity: 0.4 },
  buttonLabel: { fontSize: fontSize.lg, color: colors.textSecondary, lineHeight: 18 },
  buttonLabelPrimary: { color: colors.white },
  buttonLabelDisabled: { color: colors.textTertiary },
  value: {
    fontSize: fontSize.md,
    fontWeight: '600',
    minWidth: 34,
    textAlign: 'center',
    color: colors.textPrimary,
    padding: 0,
  },
});
