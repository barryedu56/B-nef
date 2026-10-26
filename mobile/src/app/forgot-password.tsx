import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { confirmPasswordReset, requestPasswordReset } from '@/api/auth';
import { ApiError } from '@/api/client';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { PasswordStrength } from '@/components/auth/PasswordStrength';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
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
      setCode('');
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

  const stepIndex = step === 'request' ? 1 : step === 'confirm' ? 2 : 3;
  const titles = {
    request: ['Mot de passe oublié', "Indique ton nom d'utilisateur ou ton e-mail : on t'envoie un code à 6 chiffres."],
    confirm: ['Vérifie tes e-mails', 'Saisis le code reçu et choisis un nouveau mot de passe.'],
    done: ['C’est fait !', 'Ton mot de passe a été changé.'],
  }[step];

  return (
    <AuthScreen title={titles[0]} subtitle={titles[1]}>
      <View style={styles.steps} accessibilityLabel={`Étape ${stepIndex} sur 3`}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={[styles.step, i <= stepIndex && styles.stepDone]} />
        ))}
      </View>

      {step === 'request' ? (
        <View style={styles.form}>
          <TextField label="Nom d'utilisateur ou e-mail" icon="person-outline" value={identifier} onChangeText={setIdentifier} autoCapitalize="none" autoComplete="username" />
          {error ? <Alert message={error} /> : null}
          <Button label="Envoyer le code" onPress={onRequest} loading={loading} />
        </View>
      ) : null}

      {step === 'confirm' ? (
        <View style={styles.form}>
          {info ? <Alert tone="info" icon="mail-unread-outline" message={`${info} Il est valable 15 minutes. Pense à regarder dans les spams.`} /> : null}
          <TextField
            label="Code à 6 chiffres"
            icon="keypad-outline"
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="••••••"
            inputStyle={styles.codeInput}
          />
          <TextField label="Nouveau mot de passe" icon="lock-closed-outline" value={newPassword} onChangeText={setNewPassword} secureTextEntry autoCapitalize="none" autoComplete="new-password" />
          <PasswordStrength password={newPassword} />
          <TextField
            label="Confirmer le nouveau mot de passe"
            icon="lock-closed-outline"
            value={confirmNewPassword}
            onChangeText={setConfirmNewPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            error={confirmNewPassword && newPassword !== confirmNewPassword ? 'Les deux mots de passe ne correspondent pas.' : undefined}
          />
          {error ? <Alert message={error} /> : null}
          <Button label="Changer mon mot de passe" icon="key-outline" onPress={onConfirm} loading={loading} />
          <Button
            label="Je n'ai rien reçu — renvoyer un code"
            variant="ghost"
            onPress={() => {
              setError(null);
              setStep('request');
            }}
          />
          <Text style={styles.securityNote}>
            Pour ta sécurité : 5 essais maximum par code, et toutes tes sessions seront déconnectées.
          </Text>
        </View>
      ) : null}

      {step === 'done' ? (
        <View style={styles.form}>
          <Alert
            tone="success"
            message="Ton mot de passe a été mis à jour et toutes tes sessions ont été déconnectées. Un e-mail de confirmation t'a été envoyé."
          />
          <Button label="Se connecter" onPress={() => router.replace('/login')} />
        </View>
      ) : null}

      <Pressable onPress={() => router.replace('/login')} style={styles.back} accessibilityRole="link">
        <Ionicons name="arrow-back" size={16} color={colors.accent} />
        <Text style={styles.backText}>Retour à la connexion</Text>
      </Pressable>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  steps: { flexDirection: 'row', gap: spacing.sm, marginTop: -spacing.sm },
  step: { flex: 1, height: 4, borderRadius: 999, backgroundColor: colors.placeholder },
  stepDone: { backgroundColor: colors.accent },
  codeInput: { fontSize: 22, letterSpacing: 8, fontWeight: '700', textAlign: 'center' },
  securityNote: { fontSize: fontSize.xs, color: colors.textTertiary, textAlign: 'center', lineHeight: 17 },
  back: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.sm },
  backText: { fontSize: fontSize.sm, color: colors.accent, fontWeight: '700' },
});
