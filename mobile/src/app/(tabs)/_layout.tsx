import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { NavBar } from '@/components/nav-bar';
import { TabIcon } from '@/components/tab-icon';
import { Mint, TextColor } from '@/constants/design-system';
import { registrarDiaDeLeitura } from '@/services/biblioteca';

// Mesmas cores da bolinha, para o ícone e a bolinha combinarem
const ATIVO = Mint.mint400;
const INATIVO = TextColor.secondary;

export const unstable_settings = { initialRouteName: 'home' };

/**
 * Tracker de leitura: abrir o app (ou voltar para ele) conta o dia de hoje para os livros em
 * "Lendo". O backend ignora repetições no mesmo dia, então chamar de novo não soma nada.
 */
function useDiaDeLeitura() {
  useEffect(() => {
    const registrar = () => void registrarDiaDeLeitura().catch(() => {});
    registrar();
    const assinatura = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') registrar();
    });
    return () => assinatura.remove();
  }, []);
}

export default function TabsLayout() {
  useDiaDeLeitura();
  return (
    <Tabs
      tabBar={(props) => <NavBar {...props} />}
      screenOptions={{
        headerShown: false,
        animation: 'shift',
      }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Início',
          tabBarIcon: ({ focused, size }) => (
            <TabIcon
              source={require('../../../assets/images/home_icone_navbar.png')}
              focused={focused}
              size={size}
              activeColor={ATIVO}
              inactiveColor={INATIVO}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explorar',
          tabBarIcon: ({ focused, size }) => (
            <TabIcon
              source={require('../../../assets/images/explorar_icone_navbar.png')}
              focused={focused}
              size={size}
              activeColor={ATIVO}
              inactiveColor={INATIVO}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="biblioteca"
        options={{
          title: 'Biblioteca',
          tabBarIcon: ({ focused, size }) => (
            <TabIcon
              source={require('../../../assets/images/biblioteca_icone_navbar.png')}
              focused={focused}
              size={size}
              activeColor={ATIVO}
              inactiveColor={INATIVO}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ focused, size }) => (
            <TabIcon
              source={require('../../../assets/images/perfil_icone_navbar.png')}
              focused={focused}
              size={size}
              activeColor={ATIVO}
              inactiveColor={INATIVO}
            />
          ),
        }}
      />
    </Tabs>
  );
}
