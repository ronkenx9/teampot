import * as LocalAuthentication from 'expo-local-authentication';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Shell } from '@/components/Shell';
import { Button, CantReachTeampot, Card, Label, Pill, SectionTitle, colors } from '@/components/ui';
import { useTeampot } from '@/TeampotProvider';
import { ago, money } from '@/format';
import type { StockId } from '@/types';

export default function MoneyScreen() {
  const { state, loading, personId, refresh, payVendor, saveElection, tradeStock } = useTeampot();
  const [vendorId, setVendorId] = useState('figma');
  const [amount, setAmount] = useState('45');
  const [note, setNote] = useState('seats');
  const [confirming, setConfirming] = useState(false);
  const [stockId, setStockId] = useState<StockId>('aapl');
  const [percent, setPercent] = useState(20);
  const [trade, setTrade] = useState<null | { side: 'buy' | 'sell'; stockId: StockId; cashAmount?: number; shares?: number }>(null);
  const person = state?.people.find((p) => p.id === personId) ?? state?.people.find((p) => p.id === 'sam');
  const pot = state?.pots.find((p) => p.id === person?.team);
  const vendors = state?.vendors.filter((v) => !pot || pot.vendorIds.includes(v.id) || v.id.includes('stock')).slice(0, 5) ?? [];
  const recent = state && person ? state.activity.filter((a) => !a.who || a.who === person.id || a.potId === person.team).slice(0, 5) : [];
  const held = state && person ? state.held.find((h) => h.personId === person.id && h.status === 'held') : undefined;
  const investment = state && person ? state.investments.find((x) => x.personId === person.id) : undefined;
  const selectedStock = state?.stocks.find((s) => s.id === stockId) ?? state?.stocks[0];
  const selectedPosition = investment?.positions.find((p) => p.stockId === stockId);
  const totalInvested = investment?.positions.reduce((sum, p) => sum + p.value, 0) ?? 0;
  const totalGain = investment?.positions.reduce((sum, p) => sum + p.gain, 0) ?? 0;
  const sellShares = selectedPosition ? Number(Math.min(1, selectedPosition.shares).toFixed(4)) : 0;

  useEffect(() => {
    if (investment?.election) {
      setStockId(investment.election.stockId);
      setPercent(investment.election.percent);
    }
  }, [investment?.election?.stockId, investment?.election?.percent]);

  if (!state || !person) {
    return (
      <Shell title="Money">
        <CantReachTeampot onRetry={refresh} loading={loading} />
      </Shell>
    );
  }

  const authenticate = async (promptMessage: string) => {
    if (Platform.OS === 'web') return true;
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !enrolled) return true;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Cancel',
      fallbackLabel: 'Use passcode'
    });
    return result.success;
  };

  const authenticateAndPay = async () => {
    const ok = await authenticate('Confirm Teampot payment');
    if (!ok) return;
    setConfirming(false);
    await payVendor(vendorId, Number(amount), note);
  };

  const authenticateAndTrade = async () => {
    if (!trade) return;
    const ok = await authenticate(trade.side === 'buy' ? 'Confirm stock buy' : 'Confirm stock sale');
    if (!ok) return;
    setTrade(null);
    await tradeStock(trade.stockId, trade.side, { cashAmount: trade.cashAmount, shares: trade.shares });
  };

  return (
    <Shell title="Money">
      <Card style={styles.balanceCard}>
        <View style={styles.balanceTop}>
          <Label>Total balance</Label>
          <Pill tone="clay">Demo</Pill>
        </View>
        <Text testID="sam-money-balance" style={styles.money}>{money(person.balance)}</Text>
        <Text style={styles.caption}>{person.name.split(' ')[0]} · {pot?.team || 'Team'} money, work cards, and pay.</Text>
      </Card>

      <View style={styles.grid}>
        <Card style={styles.tile}>
          <Ionicons name="card-outline" size={24} color={colors.clay} />
          <Label>Spend</Label>
          <Text style={styles.tileValue}>{person.pot?.left != null ? money(Math.round(person.pot.left)) : pot ? money(pot.perPersonCap) : 'Ready'}</Text>
          <Text style={styles.small}>left on your {pot?.team || 'Company'} card</Text>
        </Card>
        <Card style={styles.tile}>
          <Ionicons name="archive-outline" size={24} color={colors.ink} />
          <Label>Earning</Label>
          <Text style={styles.tileValue}>{money(state.earnEntries?.find((e) => e.personId === person.id)?.balance ?? 0)}</Text>
          <Text style={styles.small}>{state.earnEntries?.find((e) => e.personId === person.id)?.mode === 'real' ? 'Earning live' : 'Illustrative for now'}</Text>
        </Card>
      </View>

      <Card>
        <View style={styles.rowBetween}>
          <View style={styles.flex}>
            <SectionTitle>Pay a Vendor</SectionTitle>
            <Text style={styles.small}>Native confirmation uses Face ID when the device supports it.</Text>
          </View>
          {held ? <Pill tone="dark">Held</Pill> : null}
        </View>
        <View style={styles.vendorWrap}>
          {vendors.map((v) => (
            <Pressable key={v.id} onPress={() => setVendorId(v.id)} style={[styles.vendorChip, vendorId === v.id && styles.vendorActive]}>
              <Text style={[styles.vendorText, vendorId === v.id && styles.vendorTextActive]}>{v.name}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.formRow}>
          <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" style={[styles.input, styles.amountInput]} placeholder="$" />
          <TextInput value={note} onChangeText={setNote} style={[styles.input, styles.noteInput]} placeholder="Note" />
        </View>
        <Button tone="clay" onPress={() => setConfirming(true)}>Confirm with Face ID</Button>
      </Card>

      <Card testID="sam-money-invest">
        <View style={styles.rowBetween}>
          <View style={styles.flex}>
            <SectionTitle>Invest</SectionTitle>
            <Text style={styles.small}>Pay-to-stocks buys test shares at delayed prices.</Text>
          </View>
          <View style={styles.investTotal}>
            <Text style={styles.holdingValue}>{money(totalInvested)}</Text>
            <Text style={[styles.gainText, totalGain < 0 && styles.lossText]}>{totalGain >= 0 ? '+' : ''}{money(totalGain, true)}</Text>
          </View>
        </View>

        <View style={styles.selectorBlock}>
          <Label>Asset</Label>
          <View style={styles.vendorWrap}>
            {state.stocks.map((stock) => (
              <Pressable key={stock.id} onPress={() => setStockId(stock.id)} style={[styles.stockChip, stockId === stock.id && styles.vendorActive]}>
                <Text style={[styles.vendorText, stockId === stock.id && styles.vendorTextActive]}>{stock.display}</Text>
                <Text style={[styles.stockPrice, stockId === stock.id && styles.stockPriceActive]}>{money(stock.lastPrice, true)} delayed</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.selectorBlock}>
          <Label>Each payday</Label>
          <View style={styles.percentRow}>
            {[0, 10, 20, 30].map((value) => (
              <Pressable key={value} onPress={() => setPercent(value)} style={[styles.percentChip, percent === value && styles.percentActive]}>
                <Text style={[styles.percentText, percent === value && styles.percentTextActive]}>{value}%</Text>
              </Pressable>
            ))}
            <Button tone="clay" onPress={() => saveElection(stockId, percent)} style={styles.saveElection}>Save</Button>
          </View>
        </View>

        <View style={styles.tradeRow}>
          <Button tone="dark" onPress={() => setTrade({ side: 'buy', stockId, cashAmount: 50 })} style={styles.tradeButton}>Buy $50</Button>
          <Button tone="plain" disabled={!sellShares} onPress={() => setTrade({ side: 'sell', stockId, shares: sellShares })} style={styles.tradeButton}>Sell</Button>
        </View>

        <View style={styles.holdings}>
          {(investment?.positions.length ? investment.positions : []).map((position) => {
            const stock = state.stocks.find((s) => s.id === position.stockId);
            return (
              <Pressable key={position.stockId} onPress={() => setStockId(position.stockId)} style={styles.holdingRow}>
                <View style={styles.flex}>
                  <Text style={styles.holdingName}>{stock?.display || position.stockId}</Text>
                  <Text style={styles.small}>{position.shares.toFixed(4)} shares · {stock ? `${money(stock.lastPrice, true)} delayed` : 'delayed'}</Text>
                </View>
                <View style={styles.holdingRight}>
                  <Text style={styles.holdingValue}>{money(position.value)}</Text>
                  <Text style={[styles.gainText, position.gain < 0 && styles.lossText]}>{position.gain >= 0 ? '+' : ''}{money(position.gain, true)}</Text>
                </View>
              </Pressable>
            );
          })}
          {!investment?.positions.length ? <Text style={styles.body}>No test holdings yet. Buy $50 or save a payday election to start.</Text> : null}
        </View>
      </Card>

      {held ? (
        <Card style={styles.heldCard}>
          <Pill tone="clay">Held for approval</Pill>
          <Text style={styles.heldTitle}>{money(held.amount)} at {state.vendors.find((v) => v.id === held.vendorId)?.name}</Text>
          <Text style={styles.body}>{held.reason === 'finance-rule' ? 'Finance needs to approve this one.' : 'Ava can approve or return this request.'}</Text>
        </Card>
      ) : null}

      <Card>
        <SectionTitle>Recent Activity</SectionTitle>
        {recent.map((a) => (
          <View key={a.id} style={styles.activity}>
            <View style={styles.activityDot} />
            <View style={styles.activityText}>
              <Text style={styles.activityTitle}>{a.title}</Text>
              <Text style={styles.small}>{a.detail} · {ago(a.at)}</Text>
            </View>
            {a.amount ? <Text style={styles.activityAmount}>{money(a.amount)}</Text> : null}
          </View>
        ))}
      </Card>

      <Modal visible={confirming} transparent animationType="slide" onRequestClose={() => setConfirming(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.faceCircle}><Ionicons name="scan-outline" size={34} color={colors.paper} /></View>
            <Text style={styles.sheetTitle}>Confirm Payment</Text>
            <Text style={styles.sheetBody}>{money(Number(amount || 0), true)} to {state.vendors.find((v) => v.id === vendorId)?.name}</Text>
            <Button tone="clay" onPress={authenticateAndPay}>Use Face ID</Button>
            <Button tone="plain" onPress={() => setConfirming(false)}>Cancel</Button>
          </View>
        </View>
      </Modal>

      <Modal visible={!!trade} transparent animationType="slide" onRequestClose={() => setTrade(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.faceCircle}><Ionicons name="scan-outline" size={34} color={colors.paper} /></View>
            <Text style={styles.sheetTitle}>{trade?.side === 'buy' ? 'Confirm Buy' : 'Confirm Sale'}</Text>
            <Text style={styles.sheetBody}>
              {trade?.side === 'buy'
                ? `Buy $50 of ${selectedStock?.display || 'stock'} at a delayed price`
                : `Sell ${trade?.shares ?? 0} shares of ${selectedStock?.display || 'stock'}`}
            </Text>
            <Button tone="clay" onPress={authenticateAndTrade}>Use Face ID</Button>
            <Button tone="plain" onPress={() => setTrade(null)}>Cancel</Button>
          </View>
        </View>
      </Modal>
    </Shell>
  );
}

const styles = StyleSheet.create({
  balanceCard: { backgroundColor: '#FFFDF9' },
  balanceTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  money: { color: colors.ink, fontSize: 58, fontFamily: 'InterTight_800ExtraBold_Italic', letterSpacing: 0 },
  caption: { color: colors.muted, fontSize: 15, fontFamily: 'InterTight_600SemiBold' },
  grid: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, minHeight: 138 },
  tileValue: { color: colors.ink, fontSize: 24, fontFamily: 'InterTight_800ExtraBold' },
  small: { color: colors.muted, fontSize: 13, fontFamily: 'InterTight_600SemiBold' },
  body: { color: colors.muted, fontSize: 15, lineHeight: 21, fontFamily: 'InterTight_400Regular' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' },
  flex: { flex: 1, minWidth: 0 },
  vendorWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  vendorChip: { borderRadius: 999, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: colors.paper },
  vendorActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  vendorText: { color: colors.ink, fontFamily: 'InterTight_700Bold' },
  vendorTextActive: { color: colors.paper },
  formRow: { flexDirection: 'row', gap: 10 },
  input: { minHeight: 50, borderRadius: 8, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, color: colors.ink, fontFamily: 'InterTight_700Bold', backgroundColor: '#FFFDF9' },
  amountInput: { width: 98 },
  noteInput: { flex: 1 },
  selectorBlock: { gap: 8 },
  stockChip: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: colors.paper, minWidth: 104 },
  stockPrice: { color: colors.muted, fontFamily: 'InterTight_600SemiBold', fontSize: 12, marginTop: 2 },
  stockPriceActive: { color: colors.paper },
  percentRow: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  percentChip: { width: 54, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FFFDF9' },
  percentActive: { backgroundColor: colors.clay, borderColor: colors.clay },
  percentText: { color: colors.ink, fontFamily: 'InterTight_800ExtraBold', fontSize: 15 },
  percentTextActive: { color: colors.paper },
  saveElection: { minWidth: 82, minHeight: 42 },
  tradeRow: { flexDirection: 'row', gap: 10 },
  tradeButton: { flex: 1 },
  investTotal: { alignItems: 'flex-end' },
  holdings: { gap: 8 },
  holdingRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: colors.line },
  holdingName: { color: colors.ink, fontFamily: 'InterTight_700Bold', fontSize: 16 },
  holdingValue: { color: colors.clay, fontFamily: 'InterTight_800ExtraBold', fontSize: 18 },
  holdingRight: { alignItems: 'flex-end' },
  gainText: { color: '#2E7D32', fontFamily: 'InterTight_700Bold', fontSize: 12 },
  lossText: { color: colors.clay },
  heldCard: { borderColor: '#F3C8B9', backgroundColor: '#FFF7ED' },
  heldTitle: { color: colors.ink, fontFamily: 'InterTight_800ExtraBold', fontSize: 21 },
  activity: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line },
  activityDot: { width: 9, height: 9, borderRadius: 9, backgroundColor: colors.clay },
  activityText: { flex: 1 },
  activityTitle: { color: colors.ink, fontSize: 15, fontFamily: 'InterTight_700Bold' },
  activityAmount: { color: colors.ink, fontSize: 15, fontFamily: 'InterTight_800ExtraBold' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(20,20,20,0.34)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.paper, borderTopLeftRadius: 8, borderTopRightRadius: 8, padding: 22, gap: 14 },
  faceCircle: { width: 70, height: 70, borderRadius: 70, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink, alignSelf: 'center' },
  sheetTitle: { color: colors.ink, textAlign: 'center', fontSize: 25, fontFamily: 'InterTight_800ExtraBold' },
  sheetBody: { color: colors.muted, textAlign: 'center', fontSize: 16, fontFamily: 'InterTight_600SemiBold' }
});
