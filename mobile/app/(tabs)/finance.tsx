import { useThemedStyles, type ThemeColors } from '@/theme';
import { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { Shell } from '@/components/Shell';
import { Button, CantReachTeampot, Card, Label, Pill, SectionTitle } from '@/components/ui';
import { useTeampot } from '@/TeampotProvider';
import { money, shortDate } from '@/format';

export default function FinanceScreen() {
  const styles = useThemedStyles(makeStyles);
  const { state, loading, personId, refresh, runPayday } = useTeampot();
  const [confirm, setConfirm] = useState(false);

  if (!state) {
    return (
      <Shell title="Finance Overview">
        <CantReachTeampot onRetry={refresh} loading={loading} />
      </Shell>
    );
  }

  const actor = state.people.find((p) => p.id === personId);
  if (actor?.role !== 'admin') return <Shell title="Finance"><Card><SectionTitle>Finance access</SectionTitle><Text style={styles.body}>Company budgets and payday are available to Finance.</Text></Card></Shell>;
  const payrollTotal = state.people.reduce((sum, p) => sum + (p.salary || 0), 0);

  return (
    <Shell title="Finance Overview">
      <Card style={styles.hero}>
        <Label>Company balance</Label>
        <Text style={styles.balance}>{actor?.role === 'admin' ? money(state.company.balance) : 'Finance only'}</Text>
        <Text style={styles.body}>Department budgets are read-only here. Payday requires a confirmation step.</Text>
      </Card>

      <Card>
        <SectionTitle>Company Map</SectionTitle>
        {state.pots.map((p) => (
          <View key={p.id} style={styles.potRow}>
            <View style={[styles.swatch, { backgroundColor: p.color }]} />
            <View style={styles.flex}>
              <Text style={styles.potTitle}>{p.team}</Text>
              <Text style={styles.body}>{p.members.length} people · {money(p.perPersonCap)}/{p.periodLabel} cards</Text>
            </View>
            <View style={styles.right}>
              <Text style={styles.amount}>{money(p.balance)}</Text>
              <Label>of {money(p.budget)}</Label>
            </View>
          </View>
        ))}
      </Card>

      <Card>
        <View style={styles.row}>
          <View style={styles.flex}>
            <SectionTitle>Run Payday</SectionTitle>
            <Text style={styles.body}>{shortDate(state.nextPayday)} · {state.people.filter((p) => p.salary).length} people · {money(payrollTotal)}</Text>
          </View>
          <Pill tone={actor?.role === 'admin' ? 'clay' : 'plain'}>{actor?.role === 'admin' ? 'Ready' : 'Finance'}</Pill>
        </View>
        <Button tone="clay" disabled={loading || payrollTotal <= 0 || payrollTotal > state.company.balance} onPress={() => setConfirm(true)}>Review and run</Button>
      </Card>

      <Modal visible={confirm} transparent animationType="fade" onRequestClose={() => setConfirm(false)}>
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Run test payday?</Text>
            <Text style={styles.body}>This sends test funds to {state.people.filter((p) => p.salary).length} people a total of {money(payrollTotal)}.</Text>
            <Button disabled={loading} tone="clay" onPress={() => { setConfirm(false); runPayday(); }}>Run payday</Button>
            <Button tone="plain" onPress={() => setConfirm(false)}>Cancel</Button>
          </View>
        </View>
      </Modal>
    </Shell>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  hero: { backgroundColor: colors.elevated },
  balance: { color: colors.ink, fontSize: 46, fontFamily: 'Geist_300Light', letterSpacing: 0 },
  body: { color: colors.muted, fontSize: 15, lineHeight: 21, fontFamily: 'Geist_400Regular' },
  potRow: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line },
  swatch: { width: 14, height: 44, borderRadius: 7 },
  flex: { flex: 1 },
  potTitle: { color: colors.ink, fontFamily: 'Geist_500Medium', fontSize: 18 },
  right: { alignItems: 'flex-end' },
  amount: { color: colors.ink, fontFamily: 'Geist_500Medium', fontSize: 17 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  backdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: 20 },
  dialog: { width: '100%', maxWidth: 360, borderRadius: 14, padding: 18, gap: 12, backgroundColor: colors.paper },
  dialogTitle: { color: colors.ink, fontFamily: 'Geist_500Medium', fontSize: 26 }
});
