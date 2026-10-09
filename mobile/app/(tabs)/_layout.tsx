import { Ionicons } from '@expo/vector-icons';
import type { ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { colors } from '@/components/ui';

const icon = (name: keyof typeof Ionicons.glyphMap) => ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} color={String(color || colors.muted)} size={size} />;

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.clay,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: '#FFFDF9',
          borderTopColor: colors.line,
          height: 86,
          paddingTop: 8,
          paddingBottom: 18
        },
        tabBarLabelStyle: { fontFamily: 'InterTight_700Bold', fontSize: 12 }
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Money', tabBarIcon: icon('wallet-outline') }} />
      <Tabs.Screen name="approvals" options={{ title: 'OKs', tabBarIcon: icon('checkmark-done-outline') }} />
      <Tabs.Screen name="invoice" options={{ title: 'Invoice', tabBarIcon: icon('document-text-outline') }} />
      <Tabs.Screen name="finance" options={{ title: 'Finance', tabBarIcon: icon('business-outline') }} />
    </Tabs>
  );
}
