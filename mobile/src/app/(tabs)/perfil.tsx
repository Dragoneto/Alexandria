import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/action-button';
import {
  DSFonts,
  Ink,
  Mint,
  Radius,
  ScreenInset,
  Space,
  TextColor,
} from '@/constants/design-system';
import {
  getProfile,
  getProfilePhoto,
  logoutUser,
  removeProfilePhoto,
  saveProfilePhoto,
} from '@/services/auth';

type ProfileData = {
  name: string;
  email: string;
};

const PHOTO_SIZE = 256;

async function pickSquarePhoto(): Promise<string | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  const asset = picked.canceled ? null : picked.assets[0];
  if (!asset) return null;

  const side = Math.min(asset.width, asset.height);
  const source = ImageManipulator.manipulate(asset.uri);
  const cropped =
    side > 0
      ? source.crop({
          originX: Math.floor((asset.width - side) / 2),
          originY: Math.floor((asset.height - side) / 2),
          width: side,
          height: side,
        })
      : source;
  const image = await cropped.resize({ width: PHOTO_SIZE, height: PHOTO_SIZE }).renderAsync();
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  return result.base64 ?? '';
}

export default function PerfilScreen() {
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState('');

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const loadProfile = async () => {
        setLoading(true);
        setError('');

        try {
          const [response, savedPhoto] = await Promise.all([
            getProfile(),
            getProfilePhoto().catch(() => null),
          ]);

          if (isMounted) {
            setProfile(response);
            setPhoto(savedPhoto);
          }
        } catch (failure) {
          if (isMounted) {
            setError(
              failure instanceof Error
                ? failure.message
                : 'Não foi possível carregar o perfil agora.',
            );
          }
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      };

      loadProfile();

      return () => {
        isMounted = false;
      };
    }, []),
  );

  const avatarInitial = (profile?.name?.trim() || profile?.email?.trim() || '?')
    .charAt(0)
    .toUpperCase();

  const handleChangePhoto = async () => {
    if (photoBusy) return;
    setPhotoBusy(true);
    setPhotoError('');
    try {
      const base64 = await pickSquarePhoto();
      if (base64 !== null) setPhoto(await saveProfilePhoto(base64));
    } catch (failure) {
      setPhotoError(
        failure instanceof Error ? failure.message : 'Não foi possível atualizar a foto agora.',
      );
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (photoBusy) return;
    setPhotoBusy(true);
    setPhotoError('');
    try {
      await removeProfilePhoto();
      setPhoto(null);
    } catch (failure) {
      setPhotoError(
        failure instanceof Error ? failure.message : 'Não foi possível remover a foto agora.',
      );
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logoutUser();
      router.replace('/login');
    } catch {
      setError('Não foi possível sair da conta. Tente novamente.');
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.flex}>
        <View style={styles.content}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={photo ? 'Alterar foto de perfil' : 'Adicionar foto de perfil'}
            disabled={photoBusy || loading}
            onPress={handleChangePhoto}
            style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}>
            {photo ? (
              <Image
                source={{ uri: photo }}
                style={styles.avatarImage}
                contentFit="cover"
                accessibilityLabel="Foto de perfil"
              />
            ) : (
              <Text style={styles.avatarLabel}>{avatarInitial}</Text>
            )}
            {photoBusy && (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color={Mint.mint400} />
              </View>
            )}
          </Pressable>

          <View style={styles.photoActions}>
            <Pressable
              accessibilityRole="button"
              disabled={photoBusy || loading}
              onPress={handleChangePhoto}
              style={({ pressed }) => pressed && styles.pressed}>
              <Text style={styles.photoAction}>{photo ? 'Alterar foto' : 'Adicionar foto'}</Text>
            </Pressable>
            {photo && (
              <Pressable
                accessibilityRole="button"
                disabled={photoBusy}
                onPress={handleRemovePhoto}
                style={({ pressed }) => pressed && styles.pressed}>
                <Text style={styles.photoActionMuted}>Remover foto</Text>
              </Pressable>
            )}
          </View>

          {!!photoError && <Text style={styles.error}>{photoError}</Text>}

          <Text style={styles.title}>Meu perfil</Text>
          <Text style={styles.subtitle}>Confira os dados da sua conta.</Text>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.card}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Nome completo</Text>
              <Text style={styles.fieldValue}>
                {loading ? 'Carregando...' : profile?.name || 'Não informado'}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Email de acesso</Text>
              <Text style={styles.fieldValue}>
                {loading ? 'Carregando...' : profile?.email || 'Não informado'}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Status da conta</Text>
              <Text style={styles.fieldValue}>
                {loading ? 'Verificando...' : profile ? 'Conta ativa' : 'Indisponível'}
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            <ActionButton
              label="Editar perfil"
              onPress={() => router.push('/editar_perfil')}
            />
             <ActionButton
              label="Configurações"
              variant="ghost"
              onPress={() => router.push('/configuracoes')}
            />
            <ActionButton label="Editar perfil" onPress={() => router.push('/editar_perfil')} />
            <ActionButton
              label="Sair da conta"
              variant="ghost"
              onPress={handleLogout}
              loading={loggingOut}
            />
           

          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Ink.ink900,
  },
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: ScreenInset,
    paddingTop: Space.eight,
  },
  avatar: {
    alignSelf: 'center',
    width: 88,
    height: 88,
    borderRadius: Radius.pill,
    backgroundColor: Ink.ink600,
    borderWidth: 1,
    borderColor: Mint.mint400,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  avatarLabel: {
    fontFamily: DSFonts.display,
    fontSize: 32,
    color: Mint.mint400,
  },
  photoActions: {
    marginTop: Space.three,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Space.six,
  },
  photoAction: {
    fontFamily: DSFonts.ui,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
    color: Mint.mint400,
  },
  photoActionMuted: {
    fontFamily: DSFonts.ui,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
    color: TextColor.secondary,
  },
  pressed: {
    opacity: 0.6,
  },
  title: {
    marginTop: Space.six,
    fontFamily: DSFonts.display,
    fontSize: 28,
    lineHeight: 32,
    color: TextColor.primary,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: Space.two,
    fontFamily: DSFonts.ui,
    fontSize: 15,
    lineHeight: 24,
    color: TextColor.secondary,
    textAlign: 'center',
  },
  error: {
    marginTop: Space.four,
    fontFamily: DSFonts.ui,
    fontSize: 13,
    lineHeight: 20,
    color: '#ff7b72',
    textAlign: 'center',
  },
  card: {
    marginTop: Space.eight,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Ink.ink500,
    backgroundColor: Ink.ink700,
    paddingHorizontal: Space.four,
  },
  field: {
    paddingVertical: Space.four,
    gap: Space.one,
  },
  fieldLabel: {
    fontFamily: DSFonts.ui,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.76,
    textTransform: 'uppercase',
    color: TextColor.secondary,
  },
  fieldValue: {
    fontFamily: DSFonts.ui,
    fontSize: 16,
    lineHeight: 22,
    color: TextColor.primary,
  },
  divider: {
    height: 1,
    backgroundColor: Ink.ink500,
  },
  actions: {
    marginTop: Space.eight,
    gap: Space.four,
  },
});
