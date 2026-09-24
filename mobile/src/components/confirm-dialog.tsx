import { SymbolView, SymbolViewProps } from 'expo-symbols';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { ActionButton } from '@/components/action-button';
import {
  DSFonts,
  Ink,
  Radius,
  ScreenInset,
  Shadow,
  Space,
  TextColor,
  withAlpha,
} from '@/constants/design-system';

export type ConfirmOptions = {
  title: string;
  text?: string;
  /** Padrão: "Confirmar". */
  confirmLabel?: string;
  /** Padrão: "Cancelar". `null` esconde o botão, para aviso de uma ação só. */
  cancelLabel?: string | null;
  /** Pinta a ação de coral, para remoção e outras ações destrutivas. */
  danger?: boolean;
  /** Selo acima do título, usado pela confirmação de cadastro. */
  badge?: { icon: SymbolViewProps['name']; color: string };
};

type ConfirmDialogProps = {
  options: ConfirmOptions | null;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Diálogo no centro da tela, com o fundo escurecido. */
export function ConfirmDialog({ options, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Modal
      visible={options !== null}
      transparent
      animationType="fade"
      statusBarTranslucent
      // Botão voltar do Android equivale a cancelar
      onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        {/* O toque dentro do cartão não fecha o diálogo */}
        <Pressable style={styles.cardArea} onPress={() => {}}>
          <Animated.View
            entering={ZoomIn.duration(250)}
            style={styles.card}
            accessibilityViewIsModal>
            {options?.badge ? (
              <Animated.View
                entering={ZoomIn.delay(150).duration(300)}
                style={[
                  styles.badge,
                  {
                    backgroundColor: withAlpha(options.badge.color, 0.14),
                    borderColor: withAlpha(options.badge.color, 0.35),
                  },
                ]}>
                <SymbolView
                  name={options.badge.icon}
                  size={34}
                  weight="bold"
                  tintColor={options.badge.color}
                />
              </Animated.View>
            ) : null}

            <Text accessibilityRole="header" style={styles.title}>
              {options?.title}
            </Text>

            {options?.text ? <Text style={styles.text}>{options.text}</Text> : null}

            <View style={styles.actions}>
              <ActionButton
                label={options?.confirmLabel ?? 'Confirmar'}
                variant={options?.danger ? 'danger' : 'primary'}
                onPress={onConfirm}
              />
              {options?.cancelLabel === null ? null : (
                <ActionButton
                  label={options?.cancelLabel ?? 'Cancelar'}
                  variant="ghost"
                  onPress={onCancel}
                />
              )}
            </View>
          </Animated.View>
        </Pressable>
      </Pressable>
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
  cardArea: {
    width: '100%',
    maxWidth: 400,
  },
  card: {
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
  badge: {
    width: 72,
    height: 72,
    borderRadius: Radius.pill,
    borderWidth: 1,
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
  text: {
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
    gap: Space.three,
  },
});
