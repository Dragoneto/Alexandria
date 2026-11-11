import { Image } from 'expo-image';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { ActionButton } from '@/components/action-button';
import {
  Accent,
  DSFonts,
  Ink,
  Radius,
  ScreenInset,
  Shadow,
  Space,
  TextColor,
  withAlpha,
} from '@/constants/design-system';

type PopupMarcarLidoProps = {
  visible: boolean;
  titulo?: string;
  salvando: boolean;
  erro?: string;
  onMarcar: () => void;
  onDepois: () => void;
};

/** A coruja sugere marcar o livro como lido logo depois de uma avaliação nova. */
export function PopupMarcarLido({
  visible,
  titulo,
  salvando,
  erro,
  onMarcar,
  onDepois,
}: PopupMarcarLidoProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      // Botão voltar do Android faz o mesmo que "Agora não"
      onRequestClose={salvando ? undefined : onDepois}>
      <View style={styles.overlay}>
        <Animated.View entering={ZoomIn.duration(250)} style={styles.card} accessibilityViewIsModal>
          <Animated.View entering={ZoomIn.delay(150).duration(300)}>
            <Image
              source={require('@/assets/images/logo_app.png')}
              style={styles.coruja}
              contentFit="contain"
              accessibilityLabel="Coruja do Alexandria"
            />
          </Animated.View>

          <View style={styles.balao}>
            <Text accessibilityRole="header" style={styles.fala}>
              Avaliação publicada! Que tal colocar esse livro como lido na sua biblioteca?
            </Text>
          </View>

          {titulo ? (
            <Text style={styles.livro} numberOfLines={2}>
              {titulo}
            </Text>
          ) : null}

          {erro ? (
            <Text style={styles.erro} accessibilityLiveRegion="polite">
              {erro}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <ActionButton label="Marcar como lido" onPress={onMarcar} loading={salvando} />
            <ActionButton
              label="Agora não"
              variant="ghost"
              onPress={onDepois}
              disabled={salvando}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: withAlpha(Ink.ink900, 0.8),
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: ScreenInset,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    backgroundColor: Ink.ink700,
    borderRadius: Radius.sheet,
    borderWidth: 1,
    borderColor: Ink.ink500,
    paddingHorizontal: Space.six,
    paddingTop: Space.six,
    paddingBottom: Space.six,
    ...Shadow.e2,
  },
  coruja: {
    width: 96,
    height: 96,
  },
  // Balão de fala da coruja
  balao: {
    marginTop: Space.four,
    paddingHorizontal: Space.four,
    paddingVertical: Space.three,
    borderRadius: Radius.card,
    backgroundColor: Ink.ink600,
  },
  fala: {
    fontFamily: DSFonts.display,
    fontSize: 18,
    lineHeight: 26,
    color: TextColor.primary,
    textAlign: 'center',
  },
  livro: {
    marginTop: Space.three,
    fontFamily: DSFonts.ui,
    fontSize: 14,
    lineHeight: 20,
    color: TextColor.secondary,
    textAlign: 'center',
  },
  erro: {
    marginTop: Space.three,
    fontFamily: DSFonts.ui,
    fontSize: 14,
    lineHeight: 20,
    color: Accent.coral,
    textAlign: 'center',
  },
  actions: {
    alignSelf: 'stretch',
    gap: Space.three,
    marginTop: Space.six,
  },
});
