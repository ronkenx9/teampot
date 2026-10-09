import { StyleSheet, Text, View } from 'react-native';
import { Shell } from '@/components/Shell';
import { Button, CantReachTeampot, Card, Label, Pill, SectionTitle, colors } from '@/components/ui';
import { useTeampot } from '@/TeampotProvider';
import { money } from '@/format';

export default function ApprovalsScreen() {
  const { state, loading, personId, refresh, decideHeld } = useTeampot();
  if (!state) {
    return (
      <Shell title="Needs Your OK">
        <CantReachTeampot onRetry={refresh} loading={loading} />
      </Shell>
    );
  }

  const actor = state.people.find((p) => p.id === personId);
  const visible = state.held.filter((h) => h.status === 'held' && (actor?.role === 'admin' || h.potId === actor?.team));

  return (
    <Shell title="Needs Your OK">
      <Card>
        <SectionTitle>Ava’s Queue</SectionTitle>
        <Text style={styles.body}>{actor?.role === 'lead' ? 'Requests from your department appear here.' : actor?.role === 'admin' ? 'Finance can decide every held payment.' : 'Switch to Ava or Finance in the demo picker to approve payments.'}</Text>
      </Card>

      {visible.length === 0 ? (
        <Card style={styles.empty}>
          <Pill tone="dark">Clear</Pill>
          <Text style={styles.emptyTitle}>No open approvals</Text>
          <Text style={styles.body}>Held payments will show with vendor, amount, note, and decision controls.</Text>
        </Card>
      ) : visible.map((h) => {
        const who = state.people.find((p) => p.id === h.personId);
        const vendor = state.vendors.find((v) => v.id === h.vendorId);
        const pot = state.pots.find((p) => p.id === h.potId);
        return (
          <Card key={h.id}>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Label>{who?.name || h.personId} · {pot?.team || h.potId}</Label>
                <Text style={styles.title}>{vendor?.name || h.vendorId}</Text>
                <Text style={styles.body}>{h.note}</Text>
              </View>
              <Text style={styles.amount}>{money(h.amount)}</Text>
            </View>
            <View style={styles.actions}>
              <Button tone="plain" onPress={() => decideHeld(h.id, 'return')} style={styles.action}>Return</Button>
              <Button tone="dark" onPress={() => decideHeld(h.id, 'approve')} style={styles.action}>Approve</Button>
              {h.reason === 'new-vendor' ? <Button tone="clay" onPress={() => decideHeld(h.id, 'approve-add')} style={styles.action}>Add vendor</Button> : null}
            </View>
          </Card>
        );
      })}
    </Shell>
  );
}

const styles = StyleSheet.create({
  body: { color: colors.muted, fontSize: 15, lineHeight: 21, fontFamily: 'InterTight_400Regular' },
  empty: { alignItems: 'flex-start' },
  emptyTitle: { color: colors.ink, fontFamily: 'InterTight_800ExtraBold', fontSize: 24 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  flex: { flex: 1 },
  title: { color: colors.ink, fontSize: 22, fontFamily: 'InterTight_800ExtraBold' },
  amount: { color: colors.clay, fontSize: 21, fontFamily: 'InterTight_800ExtraBold_Italic' },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  action: { flexGrow: 1, minWidth: 104 }
});
