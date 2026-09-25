import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { deleteAvatar, updateMe, uploadAvatar } from '@/api/auth';
import { ApiError } from '@/api/client';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PickerField } from '@/components/ui/PickerField';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/context/AuthContext';
import { colors, fontSize, spacing } from '@/theme';

const CURRENCY_OPTIONS = [
  { value: 'GNF', label: 'Franc guinéen (GNF)' },
  { value: 'XOF', label: 'Franc CFA — BCEAO (XOF)' },
  { value: 'USD', label: 'Dollar américain (USD)' },
  { value: 'EUR', label: 'Euro (EUR)' },
];

export default function AccountScreen() {
  const { user, signOut, refreshUser } = useAuth();
  const [saving, setSaving] = useState<'base' | 'display' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);

  if (!user) return null;

  const onPickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError("Autorise l'accès aux photos pour choisir une photo de profil.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setError(null);
    setAvatarBusy(true);
    try {
      const uriParts = asset.uri.split('.');
      const ext = uriParts.length > 1 ? uriParts[uriParts.length - 1] : 'jpg';
      await uploadAvatar({ uri: asset.uri, name: `avatar.${ext}`, type: asset.mimeType ?? `image/${ext}` });
      await refreshUser();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Impossible d'envoyer cette photo.");
    } finally {
      setAvatarBusy(false);
    }
  };

  const onRemoveAvatar = () => {
    Alert.alert('Retirer la photo de profil ?', undefined, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Retirer',
        style: 'destructive',
        onPress: async () => {
          setAvatarBusy(true);
          try {
            await deleteAvatar();
            await refreshUser();
          } catch (e) {
            setError(e instanceof ApiError ? e.message : 'Impossible de retirer cette photo.');
          } finally {
            setAvatarBusy(false);
          }
        },
      },
    ]);
  };

  const onChangeBaseCurrency = async (code: string) => {
    setSaving('base');
    setError(null);
    try {
      await updateMe({ base_currency: code });
      await refreshUser();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Échec de la mise à jour.');
    } finally {
      setSaving(null);
    }
  };

  const onChangeDisplayCurrency = async (code: string) => {
    setSaving('display');
    setError(null);
    try {
      await updateMe({ display_currency: code });
      await refreshUser();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Échec de la mise à jour.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Réglages</Text>
      </View>

      <View style={styles.content}>
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Compte</Text>

          <View style={styles.avatarRow}>
            <Avatar url={user.avatar} name={user.username} size={56} />
            <View style={styles.avatarActions}>
              <Button
                label={user.avatar ? 'Changer la photo' : 'Ajouter une photo'}
                variant="secondary"
                fullWidth={false}
                onPress={onPickAvatar}
                loading={avatarBusy}
              />
              {user.avatar ? (
                <Button label="Retirer" variant="secondary" fullWidth={false} onPress={onRemoveAvatar} loading={avatarBusy} />
              ) : null}
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Nom d'utilisateur</Text>
            <Text style={styles.infoValue}>{user.username}</Text>
          </View>
          {user.email ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>E-mail</Text>
              <Text style={styles.infoValue}>{user.email}</Text>
            </View>
          ) : null}
          {user.phone ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Téléphone</Text>
              <Text style={styles.infoValue}>{user.phone}</Text>
            </View>
          ) : null}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Activités</Text>
          <Pressable style={styles.linkRow} onPress={() => router.push('/activity/archived')}>
            <Text style={styles.linkLabel}>Activités archivées</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </Pressable>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Devises</Text>
          <Text style={styles.hint}>
            La devise principale sert de référence pour la vue globale. La devise d’affichage — modifiable aussi
            depuis l’onglet Vue globale — reconvertit automatiquement les montants à afficher, sans rien saisir.
          </Text>
          <PickerField
            label="Devise principale"
            value={user.base_currency}
            options={CURRENCY_OPTIONS}
            onChange={onChangeBaseCurrency}
            disabled={saving === 'base'}
          />
          <PickerField
            label="Devise d’affichage"
            value={user.effective_display_currency}
            options={CURRENCY_OPTIONS}
            onChange={onChangeDisplayCurrency}
            disabled={saving === 'display'}
          />
        </Card>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button label="Se déconnecter" variant="danger" onPress={signOut} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  title: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.textPrimary },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  card: { gap: spacing.md },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatarActions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  sectionTitle: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.4 },
  hint: { fontSize: fontSize.xs, color: colors.textTertiary, lineHeight: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  infoValue: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textPrimary },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  linkLabel: { fontSize: fontSize.sm, color: colors.textPrimary },
  error: { fontSize: fontSize.sm, color: colors.negative },
});
