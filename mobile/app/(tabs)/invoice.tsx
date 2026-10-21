import { useTheme, useThemedStyles, type ThemeColors } from '@/theme';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Shell } from '@/components/Shell';
import { Button, CantReachTeampot, Card, Label, Pill, SectionTitle } from '@/components/ui';
import { useTeampot } from '@/TeampotProvider';
import { ago, money } from '@/format';

export default function InvoiceScreen() {
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(makeStyles);
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
  if (actor?.role !== 'contractor') return <Shell title="Invoices"><Card><SectionTitle>Contractor access</SectionTitle><Text style={styles.body}>Sign out and choose the contractor demo to submit invoices.</Text></Card></Shell>;
  const contractorId = actor.id;
  const validAmount = /^\d+(\.\d{1,2})?$/.test(amount) && Number(amount) > 0 && Number(amount) <= 1000000;
  const valid = validAmount && description.trim().length >= 3 && description.trim().length <= 120;
  const invoices = state.invoices.filter((i) => i.contractorId === contractorId);

  return (
    <Shell title="Invoices">
      <Card>
        <View style={styles.row}>
          <View style={styles.flex}>
            <SectionTitle>Send an invoice</SectionTitle>
            <Text style={styles.body}>Contractors can submit invoices and watch the payment status.</Text>
          </View>
          <Pill tone={actor?.role === 'contractor' ? 'clay' : 'plain'}>{actor?.role === 'contractor' ? 'You' : 'Demo'}</Pill>
        </View>
        <View style={styles.formRow}>
          <TextInput placeholderTextColor={colors.muted} selectionColor={colors.clayDark} keyboardAppearance={isDark ? 'dark' : 'light'} accessibilityLabel="Invoice amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" style={[styles.input, styles.amountInput]} placeholder="$" />
          <TextInput placeholderTextColor={colors.muted} selectionColor={colors.clayDark} keyboardAppearance={isDark ? 'dark' : 'light'} accessibilityLabel="Work description" maxLength={120} value={description} onChangeText={setDescription} style={[styles.input, styles.noteInput]} placeholder="Description" />
        </View>
        <Text style={styles.body}>Enter a positive amount with up to two decimal places and describe the work.</Text><Button tone="clay" disabled={loading || !valid} onPress={() => sendInvoice(Number(amount), description.trim())}>{loading ? 'Sending…' : 'Send invoice'}</Button>
      </Card>

      <Card>
        <SectionTitle>Status</SectionTitle>
        {invoices.length === 0 ? <Text style={styles.body}>No invoices yet. Your submitted work will appear here.</Text> : null}
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

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  body: { color: colors.muted, fontSize: 15, lineHeight: 21, fontFamily: 'Geist_400Regular' },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  flex: { flex: 1 },
  formRow: { flexDirection: 'row', gap: 10 },
  input: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, color: colors.ink, fontFamily: 'Geist_500Medium', backgroundColor: colors.elevated },
  amountInput: { width: 98 },
  noteInput: { flex: 1 },
  invoiceRow: { flexDirection: 'row', gap: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line },
  title: { color: colors.ink, fontFamily: 'Geist_500Medium', fontSize: 17 },
  right: { alignItems: 'flex-end', gap: 6 },
  amount: { color: colors.ink, fontSize: 17, fontFamily: 'Geist_300Light' }
});
