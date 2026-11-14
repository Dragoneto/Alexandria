import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/action-button';
import { FeedbackPressable } from '@/components/feedback-pressable';
import { ErrorState } from '@/components/error-state';
import { ResumoLeitura } from '@/components/resumo-leitura';
import { SkeletonText } from '@/components/skeletons';
import {
  Accent,
  DisabledOpacity,
  DSFonts,
  Ink,
  Mint,
  Radius,
  ScreenInset,
  Space,
  TextColor,
} from '@/constants/design-system';
import { getProfile, getProfilePhoto, removeProfilePhoto, saveProfilePhoto } from '@/services/auth';
import { useLoadingGate } from '@/hooks/use-loading-gate';
import { MaxContentWidth } from '@/constants/theme';

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
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const showLoading = useLoadingGate(loading);

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

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.flex}>
        <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={photo ? 'Alterar foto de perfil' : 'Adicionar foto de perfil'}
            disabled={photoBusy || loading}
            onPress={handleChangePhoto}
            style={({ pressed }) => [
              styles.avatar,
              pressed && styles.pressed,
              loading && styles.desabilitado,
            ]}>
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
            <FeedbackPressable
              accessibilityRole="button"
              accessibilityLabel={photo ? 'Alterar foto de perfil' : 'Adicionar foto de perfil'}
              accessibilityState={{ disabled: photoBusy || loading, busy: photoBusy }}
              disabled={photoBusy || loading}
              loading={photoBusy}
              loadingColor={Mint.mint400}
              onPress={handleChangePhoto}
              style={[styles.photoActionTarget, (photoBusy || loading) && styles.desabilitado]}>
              <Text style={styles.photoAction}>{photo ? 'Alterar foto' : 'Adicionar foto'}</Text>
            </FeedbackPressable>
            {photo && (
              <FeedbackPressable
                accessibilityRole="button"
                accessibilityLabel="Remover foto de perfil"
                accessibilityState={{ disabled: photoBusy, busy: photoBusy }}
                disabled={photoBusy}
                loading={photoBusy}
                loadingColor={Mint.mint400}
                onPress={handleRemovePhoto}
                style={[styles.photoActionTarget, photoBusy && styles.desabilitado]}>
                <Text style={styles.photoActionMuted}>Remover foto</Text>
              </FeedbackPressable>
            )}
          </View>

          {!!photoError && <Text style={styles.error}>{photoError}</Text>}

          {/* Nome da conta logo abaixo da foto, no lugar do antigo cartão com nome e e-mail */}
          {loading ? (
            showLoading ? (
              <View style={styles.nomeCarregando}>
                <SkeletonText width="52%" height={22} />
              </View>
            ) : null
          ) : (
            !!profile?.name?.trim() && (
              <Text style={styles.nome} accessibilityRole="header">
                {profile.name.trim()}
              </Text>
            )
          )}

          <Text style={styles.title}>Meu perfil</Text>
          <Text style={styles.subtitle}>Confira os dados da sua conta.</Text>

          <View style={styles.resumo}>
            <ResumoLeitura />
          </View>

          {!!error && (
            <ErrorState
              message={error}
              onRetry={() => {
                setLoading(true);
                setError('');
                void getProfile()
                  .then(setProfile)
                  .catch((failure) =>
                    setError(
                      failure instanceof Error
                        ? failure.message
                        : 'Não foi possível carregar o perfil agora.',
                    ),
                  )
                  .finally(() => setLoading(false));
              }}
            />
          )}

          <View style={styles.actions}>
            <ActionButton label="Editar perfil" onPress={() => router.push('/editar_perfil')} />
            <ActionButton
              label="Minhas avaliações"
              variant="ghost"
              onPress={() => router.push('/minhas-avaliacoes')}
            />
            <ActionButton
              label="Notificações"
              variant="ghost"
              onPress={() => router.push('/notificacoes')}
            />
            <ActionButton
              label="Configurações"
              variant="ghost"
              onPress={() => router.push('/configuracoes')}
            />
          </View>
        </ScrollView>
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
    flexGrow: 1,
    paddingHorizontal: ScreenInset,
    paddingTop: Space.eight,
    paddingBottom: Space.eight,
    // Coluna central em telas largas (web no computador, tablet deitado).
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
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
  photoActionTarget: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Space.two },
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
  desabilitado: {
    opacity: DisabledOpacity,
  },
  nome: {
    marginTop: Space.three,
    fontFamily: DSFonts.display,
    fontSize: 22,
    lineHeight: 28,
    color: TextColor.primary,
    textAlign: 'center',
  },
  nomeCarregando: { marginTop: Space.three, alignItems: 'center' },
  title: {
    marginTop: Space.six,
    fontFamily: DSFonts.display,
    fontSize: 28,
    lineHeight: 32,
    color: TextColor.primary,
    textAlign: 'center',
  },
  resumo: { alignSelf: 'stretch', marginTop: Space.six },
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
    color: Accent.coral,
    textAlign: 'center',
  },
  actions: {
    marginTop: Space.eight,
    gap: Space.four,
  },
});
