import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { Alert } from '@/components/ui/Alert';
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
      setError(e instanceof ApiError ? e.message : 'Impossible de se connecter.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen title="Bon retour 👋" subtitle="Connecte-toi pour retrouver tes activités et tes chiffres.">
      <View style={styles.form}>
        <TextField
          label="Nom d'utilisateur"
          icon="person-outline"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoComplete="username"
          placeholder="ex. amadou"
        />
        <TextField
          label="Mot de passe"
          icon="lock-closed-outline"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
        />
        <Link href="/forgot-password" style={styles.forgotLink}>
          Mot de passe oublié ?
        </Link>
        {error ? <Alert message={error} /> : null}
        <Button label="Se connecter" onPress={onSubmit} loading={loading} />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Pas encore de compte ?</Text>
        <Link href="/register" style={styles.link}>
          Créer un compte gratuit
        </Link>
      </View>
      <View style={styles.trust}>
        <Ionicons name="shield-checkmark-outline" size={14} color={colors.textTertiary} />
        <Text style={styles.trustText}>Connexion chiffrée · tes données restent privées</Text>
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  forgotLink: { fontSize: fontSize.sm, color: colors.accent, fontWeight: '700', alignSelf: 'flex-end', marginTop: -6 },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 6, flexWrap: 'wrap' },
  footerText: { fontSize: fontSize.sm, color: colors.textSecondary },
  link: { fontSize: fontSize.sm, color: colors.accent, fontWeight: '700' },
  trust: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  trustText: { fontSize: fontSize.xs, color: colors.textTertiary },
});
