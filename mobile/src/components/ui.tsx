import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

import { useThemedStyles, type ThemeColors } from '@/theme';
// Kept for non-themed legacy imports during the onboarding migration.

export function Card({ children, style, testID }: { children: ReactNode; style?: ViewStyle; testID?: string }) {
  const styles = useThemedStyles(makeStyles);
  return <View testID={testID} style={[styles.card, style]}>{children}</View>;
}

export function Pill({ children, tone = 'plain' }: { children: ReactNode; tone?: 'plain' | 'clay' | 'dark' }) {
  const styles = useThemedStyles(makeStyles);
  return <View style={[styles.pill, tone === 'clay' && styles.pillClay, tone === 'dark' && styles.pillDark]}><Text style={[styles.pillText, tone === 'dark' && styles.pillTextOn, tone === 'clay' && styles.accentText]}>{children}</Text></View>;
}

export function Button({ children, onPress, tone = 'dark', disabled = false, style }: { children: ReactNode; onPress: () => void; tone?: 'dark' | 'clay' | 'plain'; disabled?: boolean; style?: ViewStyle }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === 'clay' && styles.buttonClay,
        tone === 'plain' && styles.buttonPlain,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style
      ]}
    >
      <Text style={[styles.buttonText, tone === 'plain' && styles.buttonPlainText, tone === 'clay' && styles.accentText]}>{children}</Text>
    </Pressable>
  );
}

export function Label({ children, style }: { children: ReactNode; style?: TextStyle }) {
  const styles = useThemedStyles(makeStyles);
  return <Text style={[styles.label, style]}>{children}</Text>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function CantReachTeampot({ onRetry, loading }: { onRetry: () => void; loading: boolean }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Card>
      <SectionTitle>Can't reach Teampot</SectionTitle>
      <Text style={styles.body}>Your balances are unavailable. Check your connection and retry; no payment is sent by refreshing.</Text>
      <Button tone="clay" onPress={onRetry} disabled={loading}>{loading ? 'Retrying...' : 'Retry'}</Button>
    </Card>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.soft,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 10
  },
  pill: {
    alignSelf: 'flex-start',
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  pillClay: { backgroundColor: colors.accentFill, borderColor: colors.accentFill },
  pillDark: { backgroundColor: colors.ink, borderColor: colors.ink },
  pillText: { color: colors.ink, fontSize: 12, fontFamily: 'Geist_500Medium' },
  pillTextOn: { color: colors.paper },
  accentText: { color: colors.onAccent },
  button: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  buttonClay: { backgroundColor: colors.accentFill },
  buttonPlain: { backgroundColor: 'transparent', borderColor: colors.line, borderWidth: 1 },
  buttonText: { color: colors.paper, textAlign: 'center', fontSize: 16, fontFamily: 'Geist_500Medium' },
  buttonPlainText: { color: colors.ink },
  disabled: { opacity: 0.45 },
  pressed: { transform: [{ scale: 0.99 }], opacity: 0.86 },
  label: { color: colors.muted, fontSize: 13, fontFamily: 'Geist_400Regular' },
  body: { color: colors.muted, fontSize: 15, lineHeight: 21, fontFamily: 'Geist_400Regular' },
  sectionTitle: { color: colors.ink, fontSize: 22, fontFamily: 'Geist_500Medium', marginTop: 4 }
});
