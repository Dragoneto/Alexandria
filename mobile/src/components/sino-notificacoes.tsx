import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Accent, DSFonts, Ink, Radius, Space, TextColor } from '@/constants/design-system';
import { contarNaoLidas } from '@/services/notificacoes';

/** Sino da home com o número de notificações não lidas, atualizado sempre que a tela volta. */
export function SinoNotificacoes() {
  const router = useRouter();
  const [naoLidas, setNaoLidas] = useState(0);

  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      contarNaoLidas(controller.signal)
        .then(setNaoLidas)
        .catch(() => {
          // Sem a contagem o sino continua levando às notificações.
        });
      return () => controller.abort();
    }, []),
  );

  const rotulo = naoLidas
    ? `Notificações, ${naoLidas} não ${naoLidas === 1 ? 'lida' : 'lidas'}`
    : 'Notificações';

  return (
    <Pressable
      onPress={() => router.push('/notificacoes')}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      hitSlop={Space.two}
      style={({ pressed }) => [styles.sino, pressed && styles.pressionado]}>
      <SymbolView
        name={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }}
        size={20}
        tintColor={TextColor.primary}
      />
      {naoLidas > 0 && (
        <View style={styles.selo} pointerEvents="none">
          <Text style={styles.seloTexto}>{naoLidas > 9 ? '9+' : naoLidas}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sino: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: Ink.ink700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressionado: { opacity: 0.7 },
  selo: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: Radius.pill,
    backgroundColor: Accent.coral,
    borderWidth: 2,
    borderColor: Ink.ink900,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seloTexto: {
    fontFamily: DSFonts.ui,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
    color: Ink.ink900,
  },
});
