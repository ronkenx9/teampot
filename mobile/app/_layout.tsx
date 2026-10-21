import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TeampotProvider, useTeampot } from '@/TeampotProvider';
import { BetaEntry } from '@/components/BetaEntry';
import { useTheme } from '@/theme';
import { PilotApp } from '@/pilot/PilotApp';
function SessionNavigation() {
  const { sessionStatus, betaProfile } = useTeampot();
  const { colors, isDark } = useTheme();
  return <><StatusBar style={isDark ? 'light' : 'dark'} />{sessionStatus !== 'signedIn' || !betaProfile ? <BetaEntry /> : <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }} />}</>;
}
export default function RootLayout() {
  const { colors } = useTheme();
  const [mode, setMode] = useState<'company' | 'demo'>('company');
  const [loaded, error] = useFonts({
    Geist_300Light: require('@expo-google-fonts/geist/300Light/Geist_300Light.ttf'),
    Geist_400Regular: require('@expo-google-fonts/geist/400Regular/Geist_400Regular.ttf'),
    Geist_500Medium: require('@expo-google-fonts/geist/500Medium/Geist_500Medium.ttf'),
    Geist_600SemiBold: require('@expo-google-fonts/geist/600SemiBold/Geist_600SemiBold.ttf')
  });
  if (!loaded && !error) return <View style={[styles.loading, { backgroundColor: colors.paper }]}><ActivityIndicator accessibilityLabel="Loading Teampot" color={colors.clayDark} /></View>;
  return <SafeAreaProvider>{mode === 'company' ? <PilotApp onExplore={() => setMode('demo')} /> : <TeampotProvider><View style={{ flex: 1 }}><SessionNavigation /><Pressable accessibilityRole="button" onPress={() => setMode('company')} style={[styles.companyReturn, { backgroundColor: colors.soft, borderColor: colors.line }]}><Text style={{ color: colors.clayDark, fontFamily: 'Geist_500Medium' }}>Return to your company account</Text></Pressable></View></TeampotProvider>}</SafeAreaProvider>;
}
const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center' }, companyReturn: { minHeight: 48, padding: 14, alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth } });
