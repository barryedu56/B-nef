import { Link, Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { PasswordStrength } from '@/components/auth/PasswordStrength';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { PhoneField } from '@/components/ui/PhoneField';
import { PickerField } from '@/components/ui/PickerField';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/context/AuthContext';
import { isValidGuineaPhone } from '@/lib/phone';
import { colors, fontSize, spacing } from '@/theme';

// Devises semées côté serveur (voir backend/apps/currencies/migrations).
const CURRENCY_OPTIONS = [
  { value: 'GNF', label: 'Franc guinéen (GNF)' },
  { value: 'XOF', label: 'Franc CFA — BCEAO (XOF)' },
  { value: 'USD', label: 'Dollar américain (USD)' },
  { value: 'EUR', label: 'Euro (EUR)' },
];

export default function RegisterScreen() {
  const { status, signUp } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [baseCurrency, setBaseCurrency] = useState('GNF');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (status === 'signedIn') return <Redirect href="/(tabs)" />;

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const onSubmit = async () => {
    if (!username.trim()) {
      setError("Choisis un nom d'utilisateur.");
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError("Indique une adresse e-mail valide — c'est ce qui te permettra de récupérer ton compte.");
      return;
    }
    if (password.length < 8) {
      setError('Le mot de passe doit faire au moins 8 caractères.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    if (phone && !isValidGuineaPhone(phone)) {
      setError('Numéro invalide : 9 chiffres, en commençant par 61, 62, 65 ou 66.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signUp({
        username: username.trim(),
        password,
        email: email.trim(),
        phone: phone.trim(),
        base_currency: baseCurrency,
      });
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Impossible de créer le compte.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen title="Créer ton compte" subtitle="Gratuit, en moins d'une minute. Tu pourras tout modifier plus tard.">
      <View style={styles.form}>
        <TextField label="Nom d'utilisateur" icon="person-outline" value={username} onChangeText={setUsername} autoCapitalize="none" autoComplete="username" placeholder="ex. amadou" />
        <TextField
          label="E-mail"
          icon="mail-outline"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          placeholder="toi@exemple.com"
          hint="Indispensable pour récupérer ton compte si tu oublies ton mot de passe."
        />
        <TextField label="Mot de passe" icon="lock-closed-outline" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="new-password" placeholder="8 caractères minimum" />
        <PasswordStrength password={password} />
        <TextField
          label="Confirmer le mot de passe"
          icon="lock-closed-outline"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          error={mismatch ? 'Les deux mots de passe ne correspondent pas.' : undefined}
        />
        <PhoneField value={phone} onChangeText={setPhone} />
        <PickerField label="Devise principale" value={baseCurrency} options={CURRENCY_OPTIONS} onChange={setBaseCurrency} />
        {error ? <Alert message={error} /> : null}
        <Button label="Créer mon compte" onPress={onSubmit} loading={loading} />
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerText}>Déjà un compte ?</Text>
        <Link href="/login" style={styles.link}>
          Se connecter
        </Link>
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  footerText: { fontSize: fontSize.sm, color: colors.textSecondary },
  link: { fontSize: fontSize.sm, color: colors.accent, fontWeight: '700' },
});
