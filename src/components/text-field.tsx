import { SymbolView, SymbolViewProps } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import {
  DSFonts,
  Ink,
  Mint,
  Radius,
  Space,
  TextColor,
  TouchMin,
  withAlpha,
} from '@/constants/design-system';

type TextFieldProps = Omit<TextInputProps, 'style' | 'placeholderTextColor'> & {
  label: string;
  /** Ícone à esquerda, no formato aceito pelo expo-symbols. */
  icon: SymbolViewProps['name'];
  /** Ativa o campo de senha com botão de mostrar/ocultar. */
  secure?: boolean;
};

export function TextField({ label, icon, secure = false, ...inputProps }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>

      <View
        style={[
          styles.inputRow,
          { borderColor: focused ? Mint.mint400 : Ink.ink500 },
          focused && styles.inputRowFocused,
        ]}>
        <SymbolView
          name={icon}
          size={20}
          tintColor={focused ? Mint.mint400 : TextColor.muted}
          style={styles.icon}
        />

        <TextInput
          {...inputProps}
          style={styles.input}
          placeholderTextColor={TextColor.muted}
          secureTextEntry={secure && !revealed}
          onFocus={(event) => {
            setFocused(true);
            inputProps.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            inputProps.onBlur?.(event);
          }}
        />

        {secure && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Ocultar senha' : 'Mostrar senha'}
            hitSlop={Space.two}
            onPress={() => setRevealed((current) => !current)}
            style={({ pressed }) => pressed && styles.revealPressed}>
            <SymbolView
              name={
                revealed
                  ? { ios: 'eye.slash.fill', android: 'visibility_off', web: 'visibility_off' }
                  : { ios: 'eye.fill', android: 'visibility', web: 'visibility' }
              }
              size={20}
              tintColor={TextColor.muted}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Space.two,
  },
  // Overline · sans 11 · 700 · 0.16em
  label: {
    fontFamily: DSFonts.ui,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.76,
    textTransform: 'uppercase',
    color: TextColor.secondary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.three,
    minHeight: 56,
    paddingHorizontal: Space.four,
    borderRadius: Radius.card,
    borderWidth: 1,
    // Elevada · o degrau que o design system reserva para input
    backgroundColor: Ink.ink600,
  },
  inputRowFocused: {
    backgroundColor: withAlpha(Mint.mint400, 0.06),
  },
  icon: {
    width: 20,
    height: 20,
  },
  // Corpo em 16 pt: mantém o placeholder em "sussurro" dentro da regra de >= 16px
  input: {
    flex: 1,
    minHeight: TouchMin,
    fontFamily: DSFonts.ui,
    fontSize: 16,
    lineHeight: 22,
    color: TextColor.primary,
  },
  revealPressed: {
    opacity: 0.6,
  },
});
