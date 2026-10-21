import { ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandLogo } from './BrandLogo';
import { useTheme, useThemedStyles, type ThemeColors } from '@/theme';
import { useTeampot } from '@/TeampotProvider';

export function Shell({ title, children }: { title: string; children: ReactNode }) {
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { loading, state, toast, clearToast, refresh, error, betaProfile } = useTeampot();
  const insets = useSafeAreaInsets();
  return <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
      <View style={styles.logoRow}><BrandLogo size={40} reversed={isDark} /><View style={styles.flex}><Text style={styles.company}>{state?.company.name || 'Teampot'}</Text><Text style={styles.actor}>{betaProfile?.name || 'Welcome'} · Test workspace</Text></View></View>
      {loading ? <ActivityIndicator accessibilityLabel="Updating" color={colors.clayDark} /> : null}
    </View>
    {toast ? <Pressable accessibilityRole="button" accessibilityLabel={`Dismiss: ${toast.title}`} accessibilityLiveRegion="polite" onPress={clearToast} style={[styles.toast, toast.tone === 'good' && styles.good, toast.tone === 'bad' && styles.bad]}><Text style={styles.toastTitle}>{toast.title}</Text>{toast.detail ? <Text style={styles.toastDetail}>{toast.detail}</Text> : null}<Text style={styles.dismiss}>Tap to dismiss</Text></Pressable> : null}
    {error && !toast ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor={colors.clayDark} />}>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      {children}
    </ScrollView>
  </KeyboardAvoidingView>;
}
const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  top: { paddingHorizontal: 22, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.line },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }, flex: { flex: 1 },
  company: { color: colors.ink, fontSize: 17, fontFamily: 'Geist_500Medium' }, actor: { color: colors.muted, fontSize: 12, lineHeight: 18, fontFamily: 'Geist_400Regular' },
  toast: { margin: 16, marginBottom: 0, padding: 14, borderRadius: 14, backgroundColor: colors.tint, borderWidth: 1, borderColor: colors.tintLine },
  good: { backgroundColor: colors.successSurface, borderColor: colors.successLine }, bad: { backgroundColor: colors.errorSurface, borderColor: colors.errorLine },
  toastTitle: { color: colors.ink, fontFamily: 'Geist_500Medium', fontSize: 15 }, toastDetail: { color: colors.muted, fontSize: 14, lineHeight: 20, fontFamily: 'Geist_400Regular', marginTop: 3 }, dismiss: { color: colors.muted, fontSize: 11, marginTop: 8 },
  error: { color: colors.error, margin: 16, fontSize: 14 },
  content: { padding: 22, paddingBottom: 28, gap: 16, width: '100%', maxWidth: 620, alignSelf: 'center' },
  title: { color: colors.ink, fontSize: 32, fontFamily: 'Geist_300Light', letterSpacing: -0.7, marginBottom: 4 }
});
