import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { updateMe } from '@/api/auth';
import { ApiError } from '@/api/client';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { TopBar } from '@/components/ui/TopBar';
import { useAuth } from '@/context/AuthContext';
import { isValidGuineaPhone, normalizeGuineaPhone } from '@/lib/phone';
import { spacing } from '@/theme';

/** E-mail et téléphone du compte. Changer d'e-mail demande le mot de passe :
 * l'e-mail sert à réinitialiser le mot de passe. */
export default function ProfileScreen() {
  const { user, refreshUser } = useAuth();
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;
  const emailChanged = email.trim().toLowerCase() !== (user.email ?? '').toLowerCase();
  const phoneChanged = phone !== (user.phone ?? '');

  const onSave = async () => {
    if (phone && !isValidGuineaPhone(phone)) {
      setError('Numéro invalide (ex. 622123456).');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await updateMe({
        ...(phoneChanged ? { phone } : {}),
        ...(emailChanged ? { email: email.trim(), current_password: password } : {}),
      });
      await refreshUser();
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Impossible d'enregistrer.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top']}>
      <TopBar title="Mes informations" back />
      <View style={styles.content}>
        <Card style={styles.card}>
          <TextField label="Nom d'utilisateur" icon="person-outline" value={user.username} onChangeText={() => {}} editable={false} />
          <TextField
            label="E-mail"
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextField
            label="Téléphone"
            icon="call-outline"
            value={phone}
            onChangeText={(text) => setPhone(normalizeGuineaPhone(text).slice(0, 9))}
            keyboardType="phone-pad"
            placeholder="622123456"
          />
          {emailChanged ? (
            <TextField
              label="Mot de passe (pour changer l'e-mail)"
              icon="lock-closed-outline"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
            />
          ) : null}
          {error ? <Alert message={error} /> : null}
          <Button
            label="Enregistrer"
            onPress={onSave}
            loading={busy}
            disabled={(!emailChanged && !phoneChanged) || (emailChanged && !password)}
          />
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  card: { gap: spacing.md },
});
