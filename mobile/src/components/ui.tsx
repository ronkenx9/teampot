import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

export const colors = {
  clay: '#E8552D',
  clayDark: '#B8401C',
  ink: '#141414',
  paper: '#F6F4F0',
  line: '#E2DDD3',
  muted: '#6F6A63',
  soft: '#FFFFFF'
};

export function Card({ children, style, testID }: { children: ReactNode; style?: ViewStyle; testID?: string }) {
  return <View testID={testID} style={[styles.card, style]}>{children}</View>;
}

export function Pill({ children, tone = 'plain' }: { children: ReactNode; tone?: 'plain' | 'clay' | 'dark' }) {
  return <View style={[styles.pill, tone === 'clay' && styles.pillClay, tone === 'dark' && styles.pillDark]}><Text style={[styles.pillText, tone !== 'plain' && styles.pillTextOn]}>{children}</Text></View>;
}

export function Button({ children, onPress, tone = 'dark', disabled = false, style }: { children: ReactNode; onPress: () => void; tone?: 'dark' | 'clay' | 'plain'; disabled?: boolean; style?: ViewStyle }) {
  return (
    <Pressable
      accessibilityRole="button"
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
      <Text style={[styles.buttonText, tone === 'plain' && styles.buttonPlainText]}>{children}</Text>
    </Pressable>
  );
}

export function Label({ children, style }: { children: ReactNode; style?: TextStyle }) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function CantReachTeampot({ onRetry, loading }: { onRetry: () => void; loading: boolean }) {
  return (
    <Card>
      <SectionTitle>Can't reach Teampot</SectionTitle>
      <Text style={styles.body}>The mobile app is not showing demo data. Retry when the live API is reachable.</Text>
      <Button tone="clay" onPress={onRetry} disabled={loading}>{loading ? 'Retrying...' : 'Retry'}</Button>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.soft,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 8,
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
  pillClay: { backgroundColor: colors.clay, borderColor: colors.clay },
  pillDark: { backgroundColor: colors.ink, borderColor: colors.ink },
  pillText: { color: colors.ink, fontSize: 12, fontFamily: 'InterTight_700Bold' },
  pillTextOn: { color: colors.paper },
  button: {
    minHeight: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink,
    paddingHorizontal: 16
  },
  buttonClay: { backgroundColor: colors.clay },
  buttonPlain: { backgroundColor: 'transparent', borderColor: colors.line, borderWidth: 1 },
  buttonText: { color: colors.paper, fontSize: 16, fontFamily: 'InterTight_700Bold' },
  buttonPlainText: { color: colors.ink },
  disabled: { opacity: 0.45 },
  pressed: { transform: [{ scale: 0.99 }], opacity: 0.86 },
  label: { color: colors.muted, fontSize: 13, fontFamily: 'InterTight_600SemiBold' },
  body: { color: colors.muted, fontSize: 15, lineHeight: 21, fontFamily: 'InterTight_400Regular' },
  sectionTitle: { color: colors.ink, fontSize: 22, fontFamily: 'InterTight_800ExtraBold', marginTop: 4 }
});
