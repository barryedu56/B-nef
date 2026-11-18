import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { deleteAccount, deleteAvatar, updateMe, uploadAvatar } from '@/api/auth';
import { API_URL, ApiError } from '@/api/client';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/ui/TextField';
import { PickerField } from '@/components/ui/PickerField';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/context/AuthContext';
import { useOutbox } from '@/hooks/useOffline';
import { SyncBanner } from '@/components/SyncBanner';
import { colors, fontSize, radius, spacing } from '@/theme';

const CURRENCY_OPTIONS = [
  { value: 'GNF', label: 'Franc guinéen (GNF)' },
  { value: 'XOF', label: 'Franc CFA — BCEAO (XOF)' },
  { value: 'USD', label: 'Dollar américain (USD)' },
  { value: 'EUR', label: 'Euro (EUR)' },
];

export default function AccountScreen() {
  const queryClient = useQueryClient();
  const { user, signOut, refreshUser } = useAuth();
  const outbox = useOutbox();

  const confirmSignOut = () => {
    const waiting = outbox.pending.length + outbox.failed.length;
    if (waiting === 0) {
      void signOut();
      return;
    }
    Alert.alert(
      'Opérations non envoyées',
      `${waiting} opération${waiting > 1 ? 's' : ''} saisie${waiting > 1 ? 's' : ''} hors-ligne n'${
        waiting > 1 ? 'ont' : 'a'
      } pas encore été envoyée${waiting > 1 ? 's' : ''} au serveur. Si tu te déconnectes maintenant, elle${
        waiting > 1 ? 's seront perdues' : ' sera perdue'
      }. Reconnecte-toi à internet et attends la synchronisation avant de te déconnecter.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Se déconnecter quand même', style: 'destructive', onPress: () => void signOut() },
      ]
    );
  };
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
      const { ext, type } = imageFormat(asset);
      await uploadAvatar({ uri: asset.uri, name: `avatar.${ext}`, type });
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
      // Tous les montants déjà affichés sont recalculés dans la nouvelle devise.
      await queryClient.invalidateQueries();
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
      // Tous les montants déjà affichés sont recalculés dans la nouvelle devise.
      await queryClient.invalidateQueries();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Échec de la mise à jour.');
    } finally {
      setSaving(null);
    }
  };

  const onAvatarPress = () => {
    if (!user.avatar) {
      void onPickAvatar();
      return;
    }
    Alert.alert('Photo de profil', undefined, [
      { text: 'Changer', onPress: () => void onPickAvatar() },
      { text: 'Retirer', style: 'destructive', onPress: onRemoveAvatar },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  return (
    <Screen>
      <SyncBanner />
      <View style={styles.header}>
        <Text style={styles.title}>Réglages</Text>
      </View>

      <View style={styles.content}>
        <Card style={styles.profile}>
          <Pressable onPress={onAvatarPress} accessibilityRole="button" accessibilityLabel="Photo de profil" disabled={avatarBusy}>
            <Avatar url={user.avatar} name={user.username} size={60} />
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={13} color={colors.white} />
            </View>
          </Pressable>
          <View style={styles.profileText}>
            <Text style={styles.profileName} numberOfLines={1}>{user.username}</Text>
            {user.email ? <Text style={styles.profileMeta} numberOfLines={1}>{user.email}</Text> : null}
            {user.phone ? <Text style={styles.profileMeta}>{user.phone}</Text> : null}
          </View>
        </Card>

        <Group>
          <Row icon="key-outline" color={colors.accent} label="Mot de passe" onPress={() => router.push('/change-password')} last />
        </Group>

        <Group>
          <Row icon="pricetags-outline" color={colors.info} label="Catégories et paiements" onPress={() => router.push('/categories')} />
          <Row icon="pie-chart-outline" color={colors.positive} label="Budgets" onPress={() => router.push('/budgets')} />
          <Row icon="repeat-outline" color={colors.warning} label="Dépenses fixes" onPress={() => router.push('/recurring')} />
          <Row icon="download-outline" color={colors.accent} label="Export PDF / Excel" onPress={() => router.push('/export')} />
          <Row icon="archive-outline" color={colors.textSecondary} label="Activités archivées" onPress={() => router.push('/activity/archived')} last />
        </Group>

        <Card style={styles.card}>
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

        <Group>
          <Row icon="log-out-outline" color={colors.negative} label="Se déconnecter" onPress={confirmSignOut} danger />
          <Row
            icon="shield-checkmark-outline"
            color={colors.textSecondary}
            label="Confidentialité"
            onPress={() => Linking.openURL(`${API_URL.replace(/\/api\/?$/, '')}/confidentialite`)}
            last
          />
        </Group>

        <DeleteAccountCard onDeleted={() => void signOut()} />
      </View>
    </Screen>
  );
}

type IconName = ComponentProps<typeof Ionicons>['name'];

function Group({ children }: { children: ReactNode }) {
  return <Card style={styles.group}>{children}</Card>;
}

/** Une ligne de réglage : icône colorée, libellé court, flèche. */
function Row({
  icon,
  color,
  label,
  onPress,
  danger,
  last,
}: {
  icon: IconName;
  color: string;
  label: string;
  onPress: () => void;
  danger?: boolean;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, !last && styles.rowBorder, pressed && styles.rowPressed]}>
      <View style={[styles.rowIcon, { backgroundColor: `${color}1a` }]}>
        <Ionicons name={icon} size={19} color={color} />
      </View>
      <Text style={[styles.rowLabel, danger && { color: colors.negative }]}>{label}</Text>
      {danger ? null : <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />}
    </Pressable>
  );
}

/** Suppression définitive du compte (exigence du Play Store). */
function DeleteAccountCard({ onDeleted }: { onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setError(null);
    setBusy(true);
    try {
      await deleteAccount(password);
      onDeleted();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Suppression impossible.');
    } finally {
      setBusy(false);
    }
  };

  const confirm = () =>
    Alert.alert(
      'Supprimer définitivement ?',
      'Toutes tes données seront effacées.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => void run() },
      ]
    );

  return (
    open ? (
    <Card style={styles.dangerCard}>
      <Text style={[styles.sectionTitle, { color: colors.negative }]}>Supprimer mon compte</Text>
      <Text style={styles.hint}>Tout sera effacé, sans retour possible.</Text>
      {open ? (
        <>
          <TextField
            label="Mot de passe pour confirmer"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            placeholder="Ton mot de passe"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label="Supprimer définitivement" variant="danger" onPress={confirm} loading={busy} disabled={!password} />
          <Button label="Annuler" variant="secondary" onPress={() => setOpen(false)} />
        </>
      ) : (
        null
      )}
    </Card>
    ) : (
      <Text onPress={() => setOpen(true)} style={styles.deleteLink}>
        Supprimer mon compte
      </Text>
    )
  );
}

const styles = StyleSheet.create({
  dangerCard: { gap: spacing.md, borderColor: colors.negative, marginTop: spacing.sm },
  deleteLink: { fontSize: fontSize.sm, color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.md, marginBottom: spacing.lg },
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileText: { flex: 1, gap: 2 },
  profileName: { fontSize: fontSize.xl, fontWeight: '900', color: colors.textPrimary },
  profileMeta: { fontSize: fontSize.sm, color: colors.textSecondary },
  group: { paddingVertical: 0, paddingHorizontal: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowPressed: { opacity: 0.7 },
  rowIcon: { width: 36, height: 36, borderRadius: radius.md - 4, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: fontSize.md, fontWeight: '700', color: colors.textPrimary },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  title: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.textPrimary },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  card: { gap: spacing.md },
  sectionTitle: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.4 },
  hint: { fontSize: fontSize.xs, color: colors.textTertiary, lineHeight: 16 },
  error: { fontSize: fontSize.sm, color: colors.negative },
});

/** Extension et type d'une photo choisie. Dans le navigateur, l'adresse est
 * « blob:https://…/uuid » ou « data:image/jpeg;base64,… » : on ne peut pas
 * lire l'extension après le dernier point (on obtenait « com/uuid », refusé
 * par le serveur). On part du type de l'image. */
function imageFormat(asset: { uri: string; mimeType?: string | null; fileName?: string | null }) {
  const fromData = /^data:(image\/[a-z0-9.+-]+);/i.exec(asset.uri)?.[1];
  const type = (asset.mimeType || fromData || '').toLowerCase();
  const known: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/heic': 'heic',
    'image/heif': 'heif',
  };
  if (known[type]) return { ext: known[type], type };
  const fromName = /\.([a-z0-9]{3,4})$/i.exec(asset.fileName ?? '')?.[1]?.toLowerCase();
  const fromPath = asset.uri.startsWith('file:') ? /\.([a-z0-9]{3,4})$/i.exec(asset.uri)?.[1]?.toLowerCase() : undefined;
  const ext = fromName || fromPath || 'jpg';
  return { ext: ext === 'jpeg' ? 'jpg' : ext, type: type || `image/${ext === 'jpg' ? 'jpeg' : ext}` };
}
