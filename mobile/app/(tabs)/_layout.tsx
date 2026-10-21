import Ionicons from '@expo/vector-icons/Ionicons';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tabs } from 'expo-router';
import { useTheme } from '@/theme';
import { useTeampot } from '@/TeampotProvider';
const icon = (name: keyof typeof Ionicons.glyphMap) => ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} color={String(color)} size={size} />;
export default function TabLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { state } = useTeampot();
  const role = state?.auth?.role;
  return <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.paper }, tabBarActiveTintColor: colors.clayDark, tabBarInactiveTintColor: colors.muted, tabBarStyle: { backgroundColor: colors.soft, borderTopColor: colors.line, height: 60 + insets.bottom, paddingTop: 6, paddingBottom: insets.bottom + 6 }, tabBarLabelStyle: { fontFamily: 'Geist_500Medium', fontSize: 11 }, tabBarItemStyle: { minHeight: 48 } }}>
    <Tabs.Screen name="index" options={{ title: 'Money', tabBarIcon: icon('wallet-outline') }} />
    <Tabs.Screen name="approvals" options={{ title: 'Approvals', href: role === 'admin' || role === 'lead' ? '/approvals' : null, tabBarIcon: icon('checkmark-done-outline') }} />
    <Tabs.Screen name="invoice" options={{ title: 'Invoices', href: role === 'contractor' ? '/invoice' : null, tabBarIcon: icon('document-text-outline') }} />
    <Tabs.Screen name="finance" options={{ title: 'Finance', href: role === 'admin' ? '/finance' : null, tabBarIcon: icon('business-outline') }} />
    <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('options-outline') }} />
  </Tabs>;
}
