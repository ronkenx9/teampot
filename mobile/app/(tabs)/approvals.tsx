import { useThemedStyles, type ThemeColors } from '@/theme';
import { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { Shell } from '@/components/Shell';
import { Button, CantReachTeampot, Card, Label, Pill, SectionTitle } from '@/components/ui';
import { useTeampot } from '@/TeampotProvider';
import { money } from '@/format';

export default function ApprovalsScreen() {
  const styles = useThemedStyles(makeStyles);
  const [confirm, setConfirm] = useState<{ id: string; action: 'approve' | 'approve-add' } | null>(null);
  const { state, loading, personId, refresh, decideHeld } = useTeampot();
  if (!state) {
    return (
      <Shell title="Needs Your OK">
        <CantReachTeampot onRetry={refresh} loading={loading} />
      </Shell>
    );
  }

  const actor = state.people.find((p) => p.id === personId);
  if (actor?.role !== 'admin' && actor?.role !== 'lead') return <Shell title="Approvals"><Card><SectionTitle>Lead or Finance access</SectionTitle><Text style={styles.body}>This screen is available to department leads and Finance.</Text></Card></Shell>;
  const visible = state.held.filter((h) => h.status === 'held' && (actor?.role === 'admin' || h.potId === actor?.team));

  const requested = state.held.find(h => h.id === confirm?.id);
  return (
    <Shell title="Needs Your OK">
      <Card>
        <SectionTitle>Your queue</SectionTitle>
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
        const canDecide = actor.role === 'admin' || (h.reason !== 'finance-rule' && h.personId !== actor.id);
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
            {!canDecide ? <Text style={styles.body}>{h.personId === actor.id ? 'Finance reviews your own requests.' : 'This request needs Finance approval.'}</Text> : null}
            <View style={styles.actions}>
              <Button disabled={loading || !canDecide} tone="plain" onPress={() => decideHeld(h.id, 'return')} style={styles.action}>Return</Button>
              <Button disabled={loading || !canDecide} tone="dark" onPress={() => setConfirm({ id: h.id, action: 'approve' })} style={styles.action}>Review & pay</Button>
              {h.reason === 'new-vendor' ? <Button disabled={loading || !canDecide} tone="clay" onPress={() => setConfirm({ id: h.id, action: 'approve-add' })} style={styles.action}>Review, pay & add vendor</Button> : null}
            </View>
          </Card>
        );
      })}
      <Modal visible={!!confirm && !!requested} transparent animationType="fade" onRequestClose={() => setConfirm(null)}>
        <View style={styles.backdrop}><View style={styles.dialog}>
          <SectionTitle>Approve this test payment?</SectionTitle>
          <Text style={styles.body}>{money(requested?.amount || 0)} to {state.vendors.find(v => v.id === requested?.vendorId)?.name || 'vendor'}, requested by {state.people.find(p => p.id === requested?.personId)?.name || 'your team'}.</Text>
          <Text style={styles.body}>Confirming sends test funds from the department budget.{confirm?.action === 'approve-add' ? ' This also adds the vendor to the approved list.' : ''}</Text>
          <Button disabled={loading} tone="clay" onPress={() => { const decision = confirm; setConfirm(null); if (decision) void decideHeld(decision.id, decision.action); }}>Confirm & pay test funds</Button>
          <Button tone="plain" onPress={() => setConfirm(null)}>Cancel</Button>
        </View></View>
      </Modal>
    </Shell>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: 24 },
  dialog: { width: '100%', maxWidth: 380, backgroundColor: colors.paper, borderRadius: 16, padding: 20, gap: 16 },
  body: { color: colors.muted, fontSize: 15, lineHeight: 21, fontFamily: 'Geist_400Regular' },
  empty: { alignItems: 'flex-start' },
  emptyTitle: { color: colors.ink, fontFamily: 'Geist_500Medium', fontSize: 24 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  flex: { flex: 1 },
  title: { color: colors.ink, fontSize: 22, fontFamily: 'Geist_500Medium' },
  amount: { color: colors.clayDark, fontSize: 21, fontFamily: 'Geist_300Light' },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  action: { flexGrow: 1, minWidth: 104 }
});
