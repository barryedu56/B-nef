import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { confirmPasswordReset, requestPasswordReset } from '@/api/auth';
import { ApiError } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { TopBar } from '@/components/ui/TopBar';
import { colors, fontSize, spacing } from '@/theme';

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<'request' | 'confirm' | 'done'>('request');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onRequest = async () => {
    if (!identifier.trim()) {
      setError("Indique ton nom d'utilisateur ou ton e-mail.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await requestPasswordReset(identifier.trim());
      setInfo(res.detail);
      setStep('confirm');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Impossible d'envoyer le code.");
    } finally {
      setLoading(false);
    }
  };

  const onConfirm = async () => {
    if (code.trim().length !== 6) {
      setError('Le code fait 6 chiffres.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Le mot de passe doit faire au moins 8 caractères.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await confirmPasswordReset(identifier.trim(), code.trim(), newPassword);
      setStep('done');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Code invalide ou expiré.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TopBar title="Mot de passe oublié" back onBack={() => router.replace('/login')} />
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        {step === 'request' ? (
          <View style={styles.form}>
            <Text style={styles.subtitle}>
              Indique ton nom d'utilisateur ou ton e-mail : on t'envoie un code à 6 chiffres pour choisir un
              nouveau mot de passe.
            </Text>
            <TextField label="Nom d'utilisateur ou e-mail" value={identifier} onChangeText={setIdentifier} autoCapitalize="none" />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button label="Envoyer le code" onPress={onRequest} loading={loading} />
          </View>
        ) : null}

        {step === 'confirm' ? (
          <View style={styles.form}>
            {info ? <Text style={styles.info}>{info}</Text> : null}
            <TextField label="Code reçu (6 chiffres)" value={code} onChangeText={setCode} keyboardType="number-pad" placeholder="000000" />
            <TextField label="Nouveau mot de passe" value={newPassword} onChangeText={setNewPassword} secureTextEntry autoCapitalize="none" />
            <TextField
              label="Confirmer le nouveau mot de passe"
              value={confirmNewPassword}
              onChangeText={setConfirmNewPassword}
              secureTextEntry
              autoCapitalize="none"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button label="Réinitialiser le mot de passe" onPress={onConfirm} loading={loading} />
            <Button label="Recevoir un nouveau code" variant="ghost" onPress={() => setStep('request')} />
          </View>
        ) : null}

        {step === 'done' ? (
          <View style={styles.form}>
            <Text style={styles.subtitle}>Ton mot de passe a été mis à jour. Tu peux te reconnecter.</Text>
            <Button label="Retour à la connexion" onPress={() => router.replace('/login')} />
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  wrap: { flexGrow: 1, padding: spacing.xxl, gap: spacing.xxl },
  subtitle: { fontSize: fontSize.md, color: colors.textSecondary, lineHeight: 20 },
  info: { fontSize: fontSize.sm, color: colors.positive, lineHeight: 18 },
  form: { gap: spacing.md },
  error: { fontSize: fontSize.sm, color: colors.negative },
});
