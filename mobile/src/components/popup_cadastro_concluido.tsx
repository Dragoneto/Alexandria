import { SymbolView } from 'expo-symbols';
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

type PopupCadastroConcluidoProps = {
  visible: boolean;
  /** Nome devolvido pelo backend, usado para personalizar o título. */
  nome?: string;
  onConfirm: () => void;
};

/** Confirmação exibida logo após o cadastro dar certo. */
export function PopupCadastroConcluido({ visible, nome, onConfirm }: PopupCadastroConcluidoProps) {
  const titulo = nome ? `Boas-vindas, ${nome}!` : 'Conta criada!';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      // Botão voltar do Android faz o mesmo que o botão principal
      onRequestClose={onConfirm}>
      <View style={styles.overlay}>
        <Animated.View entering={ZoomIn.duration(250)} style={styles.card} accessibilityViewIsModal>
          <Animated.View entering={ZoomIn.delay(150).duration(300)} style={styles.badge}>
            <SymbolView
              name={{ ios: 'checkmark', android: 'check', web: 'check' }}
              size={34}
              weight="bold"
              tintColor={Accent.laurel}
            />
          </Animated.View>

          <Text accessibilityRole="header" style={styles.title}>
            {titulo}
          </Text>
          <Text style={styles.message}>
            Sua conta foi criada com sucesso. Entre com seu e-mail e senha para começar a montar sua
            estante.
          </Text>

          <View style={styles.actions}>
            <ActionButton label="Fazer login" onPress={onConfirm} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Véu sobre a tela inteira
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
    paddingTop: Space.eight,
    paddingBottom: Space.six,
    ...Shadow.e2,
  },
  // Selo de sucesso — laurel é a cor de estado "sucesso" do design system
  badge: {
    width: 72,
    height: 72,
    borderRadius: Radius.pill,
    backgroundColor: withAlpha(Accent.laurel, 0.14),
    borderWidth: 1,
    borderColor: withAlpha(Accent.laurel, 0.35),
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Título · serifa 26/32
  title: {
    marginTop: Space.six,
    fontFamily: DSFonts.display,
    fontSize: 26,
    lineHeight: 32,
    color: TextColor.primary,
    textAlign: 'center',
  },
  // Corpo · sans 15/24 · 400
  message: {
    marginTop: Space.two,
    fontFamily: DSFonts.ui,
    fontSize: 15,
    lineHeight: 24,
    color: TextColor.secondary,
    textAlign: 'center',
  },
  actions: {
    alignSelf: 'stretch',
    marginTop: Space.eight,
  },
});
