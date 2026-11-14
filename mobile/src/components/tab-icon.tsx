import { Image, ImageSourcePropType } from 'react-native';

type Props = {
  source: ImageSourcePropType;
  focused: boolean;
  size: number;
  activeColor: string;
  inactiveColor: string;
};

// A cor do ícone troca direto, sem animação: na web o tintColor vira um filtro SVG, e a
// animação pelo Reanimated deixava o ícone verde depois de sair da aba (todas pareciam
// pressionadas). O nome da aba continua com a transição de cor na nav-bar.
export function TabIcon({ source, focused, size, activeColor, inactiveColor }: Props) {
  return (
    <Image
      source={source}
      resizeMode="contain"
      style={{ width: size, height: size, tintColor: focused ? activeColor : inactiveColor }}
    />
  );
}
