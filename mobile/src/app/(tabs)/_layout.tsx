import { Tabs } from 'expo-router';

import { NavBar } from '@/components/nav-bar';
import { TabIcon } from '@/components/tab-icon';
import { Mint, TextColor } from '@/constants/design-system';

// Mesmas cores da bolinha, para o ícone e a bolinha combinarem
const ATIVO = Mint.mint400;
const INATIVO = TextColor.muted;

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="home"
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
