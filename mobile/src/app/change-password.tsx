import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { changePassword } from '@/api/auth';
import { ApiError } from '@/api/client';
import { PasswordStrength } from '@/components/auth/PasswordStrength';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { TopBar } from '@/components/ui/TopBar';
import { spacing } from '@/theme';

/** Changer son mot de passe : les autres appareils sont déconnectés, celui-ci
 * reste connecté. */
export default function ChangePasswordScreen() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmNext, setConfirmNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onSubmit = async () => {
    if (next.length < 8) {
      setError('Le nouveau mot de passe doit faire au moins 8 caractères.');
      return;
    }
    if (next !== confirmNext) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await changePassword(current, next);
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Changement impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top']}>
      <TopBar title="Mot de passe" back />
      <View style={styles.content}>
        {done ? (
          <>
            <Alert tone="success" message="Mot de passe changé. Tes autres appareils ont été déconnectés ; celui-ci reste connecté." />
            <Button label="Terminé" onPress={() => router.back()} />
          </>
        ) : (
          <Card style={styles.card}>
            <TextField label="Mot de passe actuel" icon="lock-closed-outline" value={current} onChangeText={setCurrent} secureTextEntry autoCapitalize="none" autoComplete="current-password" />
            <TextField label="Nouveau mot de passe" icon="key-outline" value={next} onChangeText={setNext} secureTextEntry autoCapitalize="none" autoComplete="new-password" />
            <PasswordStrength password={next} />
            <TextField
              label="Confirmer le nouveau mot de passe"
              icon="key-outline"
              value={confirmNext}
              onChangeText={setConfirmNext}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              error={confirmNext && next !== confirmNext ? 'Les deux mots de passe ne correspondent pas.' : undefined}
            />
            {error ? <Alert message={error} /> : null}
            <Button label="Changer le mot de passe" onPress={onSubmit} loading={busy} disabled={!current || !next} />
          </Card>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  card: { gap: spacing.lg },
});
