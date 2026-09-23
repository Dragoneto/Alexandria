import { SymbolView, SymbolViewProps } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import {
  Accent,
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
  error?: string;
};

export function TextField({ label, icon, secure = false, error, ...inputProps }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const accentColor = error ? Accent.coral : focused ? Mint.mint400 : null;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>

      <View
        style={[
          styles.inputRow,
          { borderColor: accentColor ?? Ink.ink500 },
          focused && !error && styles.inputRowFocused,
        ]}>
        <SymbolView
          name={icon}
          size={20}
          tintColor={accentColor ?? TextColor.muted}
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
              accessibilityState={{ selected: revealed }}
              hitSlop={Space.one}
              onPress={() => setRevealed((current) => !current)}
              style={({ pressed }) => [
              styles.revealButton,
              revealed && styles.revealButtonActive,
              pressed && styles.revealButtonPressed,
              ]}>
            <SymbolView
            name={
            revealed
              ? { ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' }
              : { ios: 'eye', android: 'visibility', web: 'visibility' }
            }
           size={18}
           tintColor={revealed ? Mint.mint400 : TextColor.secondary}
         />
        </Pressable>
       )}

      </View>

      {error ? (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : null}
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
  revealButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Ink.ink700,
    borderWidth: 1,
    borderColor: Ink.ink500,
  },
  revealButtonActive: {
    backgroundColor: Mint.mint900,
    borderColor: withAlpha(Mint.mint400, 0.4),
  },
  revealButtonPressed: {
    transform: [{ scale: 0.92 }],
    opacity: 0.85,
  },
  error: {
    fontFamily: DSFonts.ui,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
    color: Accent.coral,
  },
});
