import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/action-button';
import {
  Accent,
  DSFonts,
  Ink,
  Mint,
  Radius,
  ScreenInset,
  Space,
  TextColor,
} from '@/constants/design-system';
import { getProfile, logoutUser } from '@/services/auth';

type ProfileData = {
  name: string;
  email: string;
};

export default function PerfilScreen() {
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const loadProfile = async () => {
        setLoading(true);
        setError('');

        try {
          const response = await getProfile();

          if (isMounted) {
            setProfile(response);
          }
        } catch {
          if (isMounted) {
            setError('Não foi possível carregar o perfil agora.');
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
          <View style={styles.avatar}>
            <Text style={styles.avatarLabel}>{avatarInitial}</Text>
          </View>

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
  },
  avatarLabel: {
    fontFamily: DSFonts.display,
    fontSize: 32,
    color: Mint.mint400,
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
    color: Accent.coral,
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
