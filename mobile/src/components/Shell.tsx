import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BrandLogo } from './BrandLogo';
import { colors } from './ui';
import { useTeampot } from '@/TeampotProvider';
import { demoPeople } from '@/types';

export function Shell({ title, children }: { title: string; children: ReactNode }) {
  const { demoLogin, loading, personId, state, toast, clearToast } = useTeampot();
  const actor = state?.people.find((p) => p.id === personId);
  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <View style={styles.logoRow}>
          <BrandLogo size={42} />
          <View>
            <Text style={styles.company}>{state?.company.name || 'Teampot'}</Text>
            <Text style={styles.actor}>{actor?.name || 'Demo'} · {actor?.title || title}</Text>
          </View>
        </View>
        {loading ? <ActivityIndicator color={colors.clay} /> : null}
      </View>

      <View style={styles.picker} accessibilityLabel="Demo persona picker">
        {demoPeople.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => demoLogin(p.id)}
            style={({ pressed }) => [styles.persona, personId === p.id && styles.personaActive, pressed && styles.pressed]}
          >
            <Text style={[styles.personaText, personId === p.id && styles.personaTextActive]}>{p.label}</Text>
          </Pressable>
        ))}
      </View>

      {toast ? (
        <Pressable onPress={clearToast} style={[styles.toast, toast.tone === 'good' && styles.good, toast.tone === 'bad' && styles.bad]}>
          <Text style={styles.toastTitle}>{toast.title}</Text>
          {toast.detail ? <Text style={styles.toastDetail}>{toast.detail}</Text> : null}
        </Pressable>
      ) : null}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{title}</Text>
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  top: {
    paddingTop: 58,
    paddingHorizontal: 18,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 },
  company: { color: colors.ink, fontSize: 17, fontFamily: 'InterTight_800ExtraBold' },
  actor: { color: colors.muted, fontSize: 13, fontFamily: 'InterTight_600SemiBold' },
  picker: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, paddingBottom: 12 },
  persona: {
    minHeight: 34,
    minWidth: 68,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#FFFDF9'
  },
  personaActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  personaText: { color: colors.ink, fontFamily: 'InterTight_700Bold', fontSize: 13 },
  personaTextActive: { color: colors.paper },
  pressed: { opacity: 0.72 },
  toast: {
    marginHorizontal: 18,
    marginBottom: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#F3C8B9'
  },
  good: { backgroundColor: '#F3F8EF', borderColor: '#CFE3C6' },
  bad: { backgroundColor: '#FFF1F1', borderColor: '#F2BABA' },
  toastTitle: { color: colors.ink, fontFamily: 'InterTight_800ExtraBold', fontSize: 14 },
  toastDetail: { color: colors.muted, fontFamily: 'InterTight_600SemiBold', marginTop: 2 },
  content: { paddingHorizontal: 18, paddingBottom: 28, gap: 14 },
  title: { color: colors.ink, fontSize: 30, fontFamily: 'InterTight_800ExtraBold', letterSpacing: 0 }
});
