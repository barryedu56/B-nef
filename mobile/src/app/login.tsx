import { Link, Redirect, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/context/AuthContext';
import { colors, fontSize, spacing } from '@/theme';

export default function LoginScreen() {
  const { status, signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (status === 'signedIn') return <Redirect href="/(tabs)" />;

  const onSubmit = async () => {
    if (!username.trim() || !password) {
      setError("Renseigne ton nom d'utilisateur et ton mot de passe.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signIn(username.trim(), password);
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Impossible de se connecter.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.wrap}>
        <View style={styles.header}>
          <Text style={styles.title}>Bénef</Text>
          <Text style={styles.subtitle}>Connecte-toi pour retrouver tes activités.</Text>
        </View>

        <View style={styles.form}>
          <TextField
            label="Nom d'utilisateur"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            placeholder="ex. amadou"
          />
          <View style={styles.passwordField}>
            <TextField
              label="Mot de passe"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              placeholder="••••••••"
            />
            <Link href="/forgot-password" style={styles.forgotLink}>
              Mot de passe oublié ?
            </Link>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label="Se connecter" onPress={onSubmit} loading={loading} />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Pas encore de compte ?</Text>
          <Link href="/register" style={styles.link}>
            Créer un compte
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  wrap: { flex: 1, justifyContent: 'center', padding: spacing.xxl, gap: spacing.xxl },
  header: { gap: spacing.xs },
  title: { fontSize: fontSize.xxxl, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: fontSize.md, color: colors.textSecondary },
  form: { gap: spacing.md },
  passwordField: { gap: 6 },
  forgotLink: { fontSize: fontSize.xs, color: colors.accent, fontWeight: '600', alignSelf: 'flex-end' },
  error: { fontSize: fontSize.sm, color: colors.negative },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  footerText: { fontSize: fontSize.sm, color: colors.textSecondary },
  link: { fontSize: fontSize.sm, color: colors.accent, fontWeight: '600' },
});
