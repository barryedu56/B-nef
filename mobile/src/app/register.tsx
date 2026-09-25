import { Link, Redirect, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
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
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Créer un compte</Text>
          <Text style={styles.subtitle}>Choisis ta devise principale — tu pourras en changer plus tard.</Text>
        </View>

        <View style={styles.form}>
          <TextField
            label="Nom d'utilisateur"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            placeholder="ex. amadou"
          />
          <TextField
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="ex. amadou@exemple.com"
          />
          <TextField
            label="Mot de passe (8 caractères min.)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />
          <TextField
            label="Confirmer le mot de passe"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
          />
          <PhoneField value={phone} onChangeText={setPhone} />
          <PickerField label="Devise principale" value={baseCurrency} options={CURRENCY_OPTIONS} onChange={setBaseCurrency} />
          <Text style={styles.hint}>
            L'e-mail est obligatoire : c'est le seul moyen de récupérer ton compte si tu oublies ton mot de passe.
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label="Créer mon compte" onPress={onSubmit} loading={loading} />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Déjà un compte ?</Text>
          <Link href="/login" style={styles.link}>
            Se connecter
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  wrap: { flexGrow: 1, justifyContent: 'center', padding: spacing.xxl, gap: spacing.xxl },
  header: { gap: spacing.xs },
  title: { fontSize: fontSize.xxxl, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: fontSize.md, color: colors.textSecondary },
  form: { gap: spacing.md },
  hint: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: -spacing.sm },
  error: { fontSize: fontSize.sm, color: colors.negative },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  footerText: { fontSize: fontSize.sm, color: colors.textSecondary },
  link: { fontSize: fontSize.sm, color: colors.accent, fontWeight: '600' },
});
