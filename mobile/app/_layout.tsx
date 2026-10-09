import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, InterTight_400Regular, InterTight_600SemiBold, InterTight_700Bold, InterTight_800ExtraBold, InterTight_800ExtraBold_Italic } from '@expo-google-fonts/inter-tight';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { TeampotProvider } from '@/TeampotProvider';
import { colors } from '@/components/ui';

export default function RootLayout() {
  const [loaded] = useFonts({
    InterTight_400Regular,
    InterTight_600SemiBold,
    InterTight_700Bold,
    InterTight_800ExtraBold,
    InterTight_800ExtraBold_Italic
  });

  if (!loaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.clay} />
      </View>
    );
  }

  return (
    <TeampotProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </TeampotProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper
  }
});
