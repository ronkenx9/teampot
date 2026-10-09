import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Shell } from '@/components/Shell';
import { Button, CantReachTeampot, Card, Label, Pill, SectionTitle, colors } from '@/components/ui';
import { useTeampot } from '@/TeampotProvider';
import { ago, money } from '@/format';

export default function InvoiceScreen() {
  const { state, loading, personId, refresh, sendInvoice } = useTeampot();
  const [amount, setAmount] = useState('850');
  const [description, setDescription] = useState('Launch illustration pack');

  if (!state) {
    return (
      <Shell title="Invoices">
        <CantReachTeampot onRetry={refresh} loading={loading} />
      </Shell>
    );
  }

  const actor = state.people.find((p) => p.id === personId);
  const contractorId = actor?.role === 'contractor' ? actor.id : 'mateo';
  const invoices = state.invoices.filter((i) => i.contractorId === contractorId);

  return (
    <Shell title="Invoices">
      <Card>
        <View style={styles.row}>
          <View style={styles.flex}>
            <SectionTitle>Mateo Sends Work</SectionTitle>
            <Text style={styles.body}>Contractors can submit invoices and watch the payment status.</Text>
          </View>
          <Pill tone={actor?.role === 'contractor' ? 'clay' : 'plain'}>{actor?.role === 'contractor' ? 'You' : 'Demo'}</Pill>
        </View>
        <View style={styles.formRow}>
          <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" style={[styles.input, styles.amountInput]} placeholder="$" />
          <TextInput value={description} onChangeText={setDescription} style={[styles.input, styles.noteInput]} placeholder="Description" />
        </View>
        <Button tone="clay" onPress={() => sendInvoice(Number(amount), description)}>Send invoice</Button>
      </Card>

      <Card>
        <SectionTitle>Status</SectionTitle>
        {invoices.map((inv) => (
          <View key={inv.id} style={styles.invoiceRow}>
            <View style={styles.flex}>
              <Label>{inv.number} · {ago(inv.at)}</Label>
              <Text style={styles.title}>{inv.description}</Text>
              {inv.declineReason ? <Text style={styles.body}>{inv.declineReason}</Text> : null}
            </View>
            <View style={styles.right}>
              <Text style={styles.amount}>{money(inv.amount)}</Text>
              <Pill tone={inv.status === 'paid' ? 'dark' : inv.status === 'declined' ? 'plain' : 'clay'}>{inv.status}</Pill>
            </View>
          </View>
        ))}
      </Card>
    </Shell>
  );
}

const styles = StyleSheet.create({
  body: { color: colors.muted, fontSize: 15, lineHeight: 21, fontFamily: 'InterTight_400Regular' },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  flex: { flex: 1 },
  formRow: { flexDirection: 'row', gap: 10 },
  input: { minHeight: 50, borderRadius: 8, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, color: colors.ink, fontFamily: 'InterTight_700Bold', backgroundColor: '#FFFDF9' },
  amountInput: { width: 98 },
  noteInput: { flex: 1 },
  invoiceRow: { flexDirection: 'row', gap: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line },
  title: { color: colors.ink, fontFamily: 'InterTight_800ExtraBold', fontSize: 17 },
  right: { alignItems: 'flex-end', gap: 6 },
  amount: { color: colors.ink, fontSize: 17, fontFamily: 'InterTight_800ExtraBold_Italic' }
});
