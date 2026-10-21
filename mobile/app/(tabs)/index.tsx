import { useTheme, useThemedStyles, type ThemeColors } from '@/theme';
import * as LocalAuthentication from 'expo-local-authentication';
import { useEffect, useRef, useState } from 'react';
import { Alert, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Shell } from '@/components/Shell';
import { Button, CantReachTeampot, Card, Label, Pill, SectionTitle } from '@/components/ui';
import { useTeampot } from '@/TeampotProvider';
import { ago, money } from '@/format';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StockId } from '@/types';

export default function MoneyScreen() {
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { state, loading, personId, refresh, payVendor, saveElection, tradeStock } = useTeampot();
  const insets = useSafeAreaInsets();
  const authBusy = useRef(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [vendorId, setVendorId] = useState('figma');
  const [amount, setAmount] = useState('45');
  const [note, setNote] = useState('seats');
  const [confirming, setConfirming] = useState(false);
  const [stockId, setStockId] = useState<StockId>('aapl');
  const [percent, setPercent] = useState(20);
  const [trade, setTrade] = useState<null | { side: 'buy' | 'sell'; stockId: StockId; cashAmount?: number; shares?: number }>(null);
  const person = state?.people.find((p) => p.id === personId);
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

  const validPayment = /^\d+(\.\d{1,2})?$/.test(amount) && Number(amount) > 0 && Number(amount) <= 1000000 && note.trim().length >= 1 && vendors.some(v => v.id === vendorId) && !!person.pot;
  const authenticate = async (promptMessage: string) => {
    if (Platform.OS === 'web') return true;
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !enrolled) { Alert.alert('Device confirmation unavailable', 'Set up Face ID or Touch ID in device settings before testing payments.'); return false; }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Cancel',
      fallbackLabel: 'Use passcode'
    });
    return result.success;
  };

  const withConfirmation = async (prompt: string, action: () => Promise<void>) => {
    if (authBusy.current || loading) return;
    authBusy.current = true; setAuthenticating(true);
    try { if (await authenticate(prompt)) await action(); }
    catch { Alert.alert('Confirmation unavailable', 'Try again when device authentication is available.'); }
    finally { authBusy.current = false; setAuthenticating(false); }
  };
  const authenticateAndPay = () => withConfirmation('Confirm test payment', async () => {
    if (!validPayment) return;
    setConfirming(false); await payVendor(vendorId, Number(amount), note.trim());
  });
  const authenticateAndTrade = () => withConfirmation('Confirm test trade', async () => {
    if (!trade) return;
    setTrade(null); await tradeStock(trade.stockId, trade.side, { cashAmount: trade.cashAmount, shares: trade.shares });
  });

  return (
    <Shell title="Money">
      <Card style={styles.balanceCard}>
        <View style={styles.balanceTop}>
          <Label>Your test balance</Label>
          <Pill tone="clay">Demo</Pill>
        </View>
        <Text testID="sam-money-balance" style={styles.money}>{money(person.balance)}</Text>
        <Text style={styles.caption}>Demo account: {person.name.split(' ')[0]} · {pot?.team || 'Team'}</Text>
      </Card>

      <View style={styles.grid}>
        <Card style={styles.tile}>
          <Ionicons name="card-outline" size={24} color={colors.clay} />
          <Label>Spend</Label>
          <Text style={styles.tileValue}>{person.pot?.left != null ? money(Math.round(person.pot.left)) : person.pot ? 'Unavailable' : 'No card'}</Text>
          <Text style={styles.small}>left on your {pot?.team || 'Company'} card</Text>
        </Card>
        <Card style={styles.tile}>
          <Ionicons name="archive-outline" size={24} color={colors.ink} />
          <Label>Earn</Label>
          <Text style={styles.tileValue}>Not enabled</Text>
          <Text style={styles.small}>Live earning is off for this beta</Text>
        </Card>
      </View>

      <Card>
        <View style={styles.rowBetween}>
          <View style={styles.flex}>
            <SectionTitle>Pay a Vendor</SectionTitle>
            <Text style={styles.small}>Test payments use device confirmation on iPhone.</Text>
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
          <TextInput placeholderTextColor={colors.muted} selectionColor={colors.clayDark} keyboardAppearance={isDark ? 'dark' : 'light'} accessibilityLabel="Payment amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" style={[styles.input, styles.amountInput]} placeholder="$" />
          <TextInput placeholderTextColor={colors.muted} selectionColor={colors.clayDark} keyboardAppearance={isDark ? 'dark' : 'light'} accessibilityLabel="Payment note" maxLength={60} value={note} onChangeText={setNote} style={[styles.input, styles.noteInput]} placeholder="Note" />
        </View>
        <Text style={styles.small}>{person.pot ? 'Enter an amount and note. Payments outside your card rules may need approval.' : 'This demo role does not have a spending card.'}</Text><Button disabled={loading || !validPayment} tone="clay" onPress={() => setConfirming(true)}>Review test payment</Button>
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
            <Button disabled={loading || !selectedStock?.ready} tone="clay" onPress={() => saveElection(stockId, percent)} style={styles.saveElection}>Save</Button>
          </View>
        </View>

        <View style={styles.tradeRow}>
          <Button disabled={loading || person.balance < 50 || !selectedStock?.ready} tone="dark" onPress={() => setTrade({ side: 'buy', stockId, cashAmount: 50 })} style={styles.tradeButton}>Buy $50</Button>
          <Button tone="plain" disabled={loading || !sellShares || !selectedStock?.ready} onPress={() => setTrade({ side: 'sell', stockId, shares: sellShares })} style={styles.tradeButton}>Sell</Button>
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
        {recent.length === 0 ? <Text style={styles.body}>No recent activity yet.</Text> : null}
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

      <Modal visible={confirming} transparent animationType="fade" onRequestClose={() => setConfirming(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 14 }]}>
            <View style={styles.faceCircle}><Ionicons name="scan-outline" size={34} color={colors.paper} /></View>
            <Text style={styles.sheetTitle}>Confirm Payment</Text>
            <Text style={styles.sheetBody}>{money(Number(amount || 0), true)} to {state.vendors.find((v) => v.id === vendorId)?.name}</Text>
            <Button disabled={loading || authenticating || !validPayment} tone="clay" onPress={authenticateAndPay}>{authenticating ? 'Confirming…' : 'Confirm test payment'}</Button>
            <Button tone="plain" onPress={() => setConfirming(false)}>Cancel</Button>
          </View>
        </View>
      </Modal>

      <Modal visible={!!trade} transparent animationType="fade" onRequestClose={() => setTrade(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 14 }]}>
            <View style={styles.faceCircle}><Ionicons name="scan-outline" size={34} color={colors.paper} /></View>
            <Text style={styles.sheetTitle}>{trade?.side === 'buy' ? 'Confirm Buy' : 'Confirm Sale'}</Text>
            <Text style={styles.sheetBody}>
              {trade?.side === 'buy'
                ? `Buy $50 of ${selectedStock?.display || 'stock'} at a delayed price`
                : `Sell ${trade?.shares ?? 0} shares of ${selectedStock?.display || 'stock'}`}
            </Text>
            <Button disabled={loading || authenticating} tone="clay" onPress={authenticateAndTrade}>{authenticating ? 'Confirming…' : 'Confirm test trade'}</Button>
            <Button tone="plain" onPress={() => setTrade(null)}>Cancel</Button>
          </View>
        </View>
      </Modal>
    </Shell>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  balanceCard: { backgroundColor: colors.elevated },
  balanceTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  money: { color: colors.ink, fontSize: 58, fontFamily: 'Geist_300Light', letterSpacing: 0 },
  caption: { color: colors.muted, fontSize: 15, fontFamily: 'Geist_400Regular' },
  grid: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, minHeight: 138 },
  tileValue: { color: colors.ink, fontSize: 24, fontFamily: 'Geist_500Medium' },
  small: { color: colors.muted, fontSize: 13, fontFamily: 'Geist_400Regular' },
  body: { color: colors.muted, fontSize: 15, lineHeight: 21, fontFamily: 'Geist_400Regular' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' },
  flex: { flex: 1, minWidth: 0 },
  vendorWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  vendorChip: { borderRadius: 999, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: colors.paper },
  vendorActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  vendorText: { color: colors.ink, fontFamily: 'Geist_500Medium' },
  vendorTextActive: { color: colors.paper },
  formRow: { flexDirection: 'row', gap: 10 },
  input: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, color: colors.ink, fontFamily: 'Geist_500Medium', backgroundColor: colors.elevated },
  amountInput: { width: 98 },
  noteInput: { flex: 1 },
  selectorBlock: { gap: 8 },
  stockChip: { borderRadius: 14, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: colors.paper, minWidth: 104 },
  stockPrice: { color: colors.muted, fontFamily: 'Geist_400Regular', fontSize: 12, marginTop: 2 },
  stockPriceActive: { color: colors.paper },
  percentRow: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  percentChip: { width: 54, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.elevated },
  percentActive: { backgroundColor: colors.accentFill, borderColor: colors.accentFill },
  percentText: { color: colors.ink, fontFamily: 'Geist_500Medium', fontSize: 15 },
  percentTextActive: { color: colors.onAccent },
  saveElection: { minWidth: 82, minHeight: 44 },
  tradeRow: { flexDirection: 'row', gap: 10 },
  tradeButton: { flex: 1 },
  investTotal: { alignItems: 'flex-end' },
  holdings: { gap: 8 },
  holdingRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: colors.line },
  holdingName: { color: colors.ink, fontFamily: 'Geist_500Medium', fontSize: 16 },
  holdingValue: { color: colors.clayDark, fontFamily: 'Geist_500Medium', fontSize: 18 },
  holdingRight: { alignItems: 'flex-end' },
  gainText: { color: colors.success, fontFamily: 'Geist_500Medium', fontSize: 12 },
  lossText: { color: colors.clayDark },
  heldCard: { borderColor: colors.tintLine, backgroundColor: colors.tint },
  heldTitle: { color: colors.ink, fontFamily: 'Geist_500Medium', fontSize: 21 },
  activity: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line },
  activityDot: { width: 9, height: 9, borderRadius: 9, backgroundColor: colors.clay },
  activityText: { flex: 1 },
  activityTitle: { color: colors.ink, fontSize: 15, fontFamily: 'Geist_500Medium' },
  activityAmount: { color: colors.ink, fontSize: 15, fontFamily: 'Geist_500Medium' },
  modalBackdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.paper, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 22, gap: 14 },
  faceCircle: { width: 70, height: 70, borderRadius: 70, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink, alignSelf: 'center' },
  sheetTitle: { color: colors.ink, textAlign: 'center', fontSize: 25, fontFamily: 'Geist_500Medium' },
  sheetBody: { color: colors.muted, textAlign: 'center', fontSize: 16, fontFamily: 'Geist_400Regular' }
});
