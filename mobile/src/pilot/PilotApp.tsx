import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Button, Card, Label, Pill, SectionTitle } from '@/components/ui';
import { BrandLogo } from '@/components/BrandLogo';
import { useTheme, useThemedStyles, type ThemeColors } from '@/theme';
import { pilotClient } from './client';
import { PilotError, inviteToken } from './clientCore';
import type { ActionDraft, ActionResult, Pairing, PendingAction, Role, Snapshot } from './types';

const labels: Record<Role, string> = { owner: 'Owner', finance: 'Finance', lead: 'Department lead', employee: 'Employee', contractor: 'Contractor' };
const money = (n?: number | null) => n == null ? 'Unavailable' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
const positive = (value: string) => /^\d+(\.\d{1,2})?$/.test(value.trim()) && Number(value) > 0;
const message = (e: unknown) => e instanceof Error ? e.message : 'Please try again.';
type Tab = 'home' | 'spend' | 'team' | 'activity';
type Confirmation = { title: string; detail: string; draft: ActionDraft } | null;

export function PilotApp({ onExplore }: { onExplore: () => void }) {
  const { colors, isDark } = useTheme(), styles = useThemedStyles(makeStyles), insets = useSafeAreaInsets();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null), [pair, setPair] = useState<Pairing | null>(null), [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false), [booting, setBooting] = useState(true), [connected, setConnected] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [tab, setTab] = useState<Tab>('home'), [confirmation, setConfirmation] = useState<Confirmation>(null), [intro, setIntro] = useState(0);
  const epoch = useRef(0), flight = useRef(false), pollFlight = useRef(false);
  const showError = useCallback((e: unknown) => { setError(message(e)); if (e instanceof PilotError && [401, 403].includes(e.status)) { setSnapshot(null); setPending(null); } if (e instanceof PilotError && e.status === 401) { setConnected(false); void pilotClient.clearConnection(); } }, []);
  const refresh = useCallback(async () => {
    const version = epoch.current;
    const next = await pilotClient.snapshot(), nextPending = await pilotClient.readPending(next);
    if (version !== epoch.current) return;
    setSnapshot(next); setPending(nextPending); setConnected(true);
  }, []);
  const run = useCallback(async (fn: () => Promise<void>) => {
    if (flight.current) return;
    flight.current = true; setBusy(true); setError(''); setNotice('');
    try { await fn(); } catch (e) { showError(e); } finally { flight.current = false; setBusy(false); }
  }, [showError]);
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const hasToken = await pilotClient.hasToken();
        if (!alive) return;
        setConnected(hasToken);
        if (hasToken) await refresh(); else { const saved = await pilotClient.readPair(); if (alive) setPair(saved); }
      } catch (e) { if (alive) showError(e); }
      finally { if (alive) setBooting(false); }
    })();
    return () => { alive = false; epoch.current++; };
  }, [refresh, showError]);
  const checkPair = useCallback(async () => {
    if (!pair || pollFlight.current || flight.current) return;
    pollFlight.current = true;
    try {
      if (await pilotClient.pollPair(pair)) {
        setPair(null); setConnected(true); setNotice('Your company account is connected.'); await refresh();
      }
    } catch (e) { if (e instanceof PilotError && e.status === 410) setPair(null); showError(e); }
    finally { pollFlight.current = false; }
  }, [pair, refresh, showError]);
  useEffect(() => {
    if (!pair) return;
    const timer = setInterval(() => { if (AppState.currentState === 'active') void checkPair(); }, 4000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void checkPair(); });
    return () => { clearInterval(timer); listener.remove(); };
  }, [pair, checkPair]);
  useEffect(() => {
    if (!connected) return;
    const listener = AppState.addEventListener('change', state => { if (state === 'active' && !flight.current) void run(refresh); });
    return () => listener.remove();
  }, [connected, refresh, run]);
  const start = () => run(async () => { const next = await pilotClient.startPair(); setPair(next); await Linking.openURL(next.verificationUrl); });
  const logout = () => run(async () => {
    epoch.current++; setSnapshot(null); setPending(null); setPair(null); setConnected(false); setConfirmation(null); setTab('home');
    await pilotClient.logout();
  });
  const readResult = (result: ActionResult) => {
    setNotice(result.message || (result.status === 'confirmed' ? 'Confirmed on Tempo testnet. Your receipt is ready.' : result.status === 'held' ? 'Sent to your approver. No payment has been made.' : result.status === 'pending' ? 'Confirmation is pending. Use Check saved request to continue safely.' : 'The action was not completed. Review the result before trying again.'));
  };
  const execute = (draft: ActionDraft) => run(async () => {
    if (!snapshot) throw new PilotError('Refresh your company to continue.');
    try { const result = await pilotClient.action(snapshot, draft); readResult(result); }
    finally { setPending(await pilotClient.readPending(snapshot)); }
    await refresh();
  });
  const setup = (path: string, body: unknown, success?: string) => run(async () => { await pilotClient.setup(path, body); await refresh(); if (success) setNotice(success); });
  const switchRole = (id: string) => run(async () => {
    if (!snapshot) return;
    const previous = snapshot;
    setConfirmation(null); setSnapshot(null); setPending(null); epoch.current++;
    try { await pilotClient.switchMembership(previous, id); } finally { await refresh(); }
  });
  const membership = snapshot?.workspace?.membership, manager = membership && ['owner', 'finance'].includes(membership.role);
  const title = tab === 'home' ? 'Your workspace' : tab === 'spend' ? 'Team spending' : tab === 'team' ? 'People & access' : 'Activity';
  const modal = <Modal visible={Boolean(confirmation)} transparent animationType="fade" onRequestClose={() => !busy && setConfirmation(null)}>
    <View style={styles.modalOverlay}><View style={styles.modalCard}><Pill>Test money only</Pill><SectionTitle>{confirmation?.title}</SectionTitle><Text style={styles.body}>{confirmation?.detail}</Text><Button disabled={busy} onPress={() => { if (!confirmation) return; const draft = confirmation.draft; setConfirmation(null); void execute(draft); }}>Confirm test action</Button><Button disabled={busy} tone="plain" onPress={() => setConfirmation(null)}>Go back</Button></View></View>
  </Modal>;

  return <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <StatusBar style={isDark ? 'light' : 'dark'} />
    <View style={[styles.top, { paddingTop: insets.top + 10 }]}><View style={styles.brand}><BrandLogo size={36} reversed={isDark} /><Text style={styles.wordmark}>teampot</Text></View>{busy || booting ? <ActivityIndicator color={colors.clayDark} accessibilityLabel="Updating company" /> : connected ? <Pressable accessibilityRole="button" onPress={() => void logout()}><Text style={styles.link}>Sign out</Text></Pressable> : <Pill>Private beta</Pill>}</View>
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={[styles.content, { paddingBottom: connected ? 26 : insets.bottom + 30 }]} refreshControl={connected ? <RefreshControl refreshing={busy} onRefresh={() => void run(refresh)} tintColor={colors.clayDark} /> : undefined}>
      {error ? <View accessibilityRole="alert" style={styles.errorBox}><Text style={styles.error}>{error}</Text><Pressable accessibilityRole="button" onPress={() => setError('')}><Text style={styles.link}>Dismiss</Text></Pressable></View> : null}
      {notice ? <View accessibilityLiveRegion="polite" style={styles.noticeBox}><Text style={styles.body}>{notice}</Text></View> : null}
      {booting ? <View style={styles.welcome}><Text style={styles.title}>Opening your workspace.</Text><Text style={styles.body}>Checking your saved company connection.</Text></View>
        : !connected ? <>
          <LinearGradient colors={isDark ? ['#30261F', '#171615', '#101010'] : ['#FFF0E6', '#FFFDF9', '#F6F4F0']} style={styles.hero}>
            <Text style={styles.eyebrow}>{pair ? 'CONNECT YOUR IPHONE' : ['WORK MONEY, TOGETHER', 'ROOM TO GET THINGS DONE', 'YOUR NAME. YOUR TEAM.'][intro]}</Text>
            <Text style={styles.welcomeTitle}>{pair ? 'One account.\nEvery device.' : ['A little more\nfreedom at work.', 'A budget.\nClear boundaries.', 'Welcome to\nyour company.'][intro]}</Text>
            <Text style={styles.heroCopy}>{pair ? 'Finish signing in with your passkey in the browser, then approve the code below. Return here when you’re done.' : ['Teampot gives your team a shared place to manage the money they need for work.', 'Finance sets the budget. Your lead gives you spending access. You can see what’s available before you pay.', 'Use your name when you create your account. Your company invitation supplies your role and access.'][intro]}</Text>
            {!pair && <View style={styles.dots}>{[0, 1, 2].map(n => <Pressable key={n} accessibilityRole="button" accessibilityLabel={`Introduction ${n + 1}`} onPress={() => setIntro(n)} style={[styles.dot, intro === n && styles.dotActive]} />)}</View>}
          </LinearGradient>
          {pair ? <Card><Label>Match this code in the browser</Label><Text selectable style={styles.code}>{pair.userCode}</Text><Text style={styles.body}>Only approve a connection you started on this phone. This code expires at {new Date(pair.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.</Text><Button disabled={busy} onPress={() => void Linking.openURL(pair.verificationUrl).catch(showError)}>Continue in browser</Button><Button tone="plain" disabled={busy} onPress={() => void checkPair()}>I approved it — check connection</Button><Pressable accessibilityRole="button" disabled={busy} onPress={() => void start()}><Text style={styles.link}>Start a new connection</Text></Pressable></Card>
            : <><Button disabled={busy} onPress={() => intro < 2 ? setIntro(intro + 1) : void start()}>{intro < 2 ? 'Continue' : 'Connect your company account'}</Button>{intro < 2 && <Pressable accessibilityRole="button" onPress={() => void start()}><Text style={styles.centerLink}>Already have an account? Connect</Text></Pressable>}<Text style={styles.fine}>Create or join a company with your passkey in the browser. Your sign-in stays separate from the shared demo.</Text><Button tone="plain" disabled={busy} onPress={onExplore}>Explore the sample company</Button></>}
        </>
        : !snapshot ? <Card><SectionTitle>Reconnect to your company</SectionTitle><Text style={styles.body}>Your balances are unavailable until we can verify your account. Refreshing does not send a payment.</Text><Button disabled={busy} onPress={() => void run(refresh)}>Refresh company</Button></Card>
        : <>
          <Text style={styles.eyebrow}>{snapshot.session.user?.name}{membership ? ` · ${labels[membership.role]}` : ''}</Text>
          <Text accessibilityRole="header" style={styles.title}>{snapshot.workspace?.workspace.name || 'Your first workspace'}</Text>
          {snapshot.session.memberships.length > 1 && <Choice label="Your assigned workspace and role" selected={snapshot.session.activeMembershipId || ''} options={snapshot.session.memberships.map(m => ({ id: m.id, label: `${m.workspaceName} · ${labels[m.role]}` }))} disabled={busy} choose={switchRole} />}
          <Pill>Tempo testnet · Test dollars</Pill>
          {pending && <Card><SectionTitle>Check your saved request</SectionTitle><Text style={styles.body}>Your {pending.payload.action} request is saved. Checking it uses the same request ID, so a connection problem won’t create another payment.</Text><Button disabled={busy} tone="clay" onPress={() => void run(async () => { try { readResult(await pilotClient.retry(snapshot)); } finally { setPending(await pilotClient.readPending(snapshot)); } await refresh(); })}>Check saved request</Button></Card>}
          {!snapshot.workspace ? <CompanySetup setup={setup} busy={busy} /> : <>
            <Label>{title}</Label>
            {tab === 'home' && <Overview key={membership!.id} snapshot={snapshot} busy={busy || Boolean(pending)} confirm={setConfirmation} team={() => setTab('team')} />}
            {tab === 'spend' && <Spending key={membership!.id} snapshot={snapshot} busy={busy || Boolean(pending)} confirm={setConfirmation} />}
            {tab === 'team' && <Team key={membership!.id} snapshot={snapshot} busy={busy} setup={setup} run={run} refresh={refresh} setNotice={setNotice} />}
            {tab === 'activity' && <Activity snapshot={snapshot} open={tx => void run(async () => { if (!/^0x[0-9a-f]{64}$/i.test(tx)) throw new Error('This receipt is not available yet.'); await Linking.openURL('https://explore.testnet.tempo.xyz/tx/' + tx); })} />}
            {tab === 'home' && manager && <Text style={styles.fine}>Company test funds and department accounts are isolated from the sample company. This beta uses server-managed testnet signing keys.</Text>}
          </>}
        </>}
    </ScrollView>
    {connected && snapshot?.workspace && <View style={[styles.tabs, { paddingBottom: Math.max(insets.bottom, 10) }]}>{(['home', 'spend', 'team', 'activity'] as Tab[]).map(t => <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === t }} key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.selectedTab]}><Text style={[styles.tabText, tab === t && styles.selectedTabText]}>{t === 'home' ? 'Home' : t === 'spend' ? 'Spending' : t === 'team' ? 'Team' : 'Activity'}</Text></Pressable>)}</View>}
    {modal}
  </KeyboardAvoidingView>;
}

function Field({ label, value, change, placeholder, numeric, disabled, multiline }: { label: string; value: string; change: (v: string) => void; placeholder?: string; numeric?: boolean; disabled?: boolean; multiline?: boolean }) {
  const styles = useThemedStyles(makeStyles), { colors } = useTheme();
  return <View style={styles.field}><Label>{label}</Label><TextInput accessibilityLabel={label} editable={!disabled} value={value} onChangeText={change} placeholder={placeholder} placeholderTextColor={colors.muted} keyboardType={numeric ? 'decimal-pad' : 'default'} autoCapitalize={numeric ? 'none' : 'sentences'} maxLength={multiline ? 240 : 100} multiline={multiline} style={[styles.input, multiline && styles.multiline]} /></View>;
}
function Choice({ label, selected, options, choose, disabled }: { label: string; selected: string; options: { id: string; label: string }[]; choose: (id: string) => void; disabled?: boolean }) {
  const styles = useThemedStyles(makeStyles);
  return <View style={styles.field}><Label>{label}</Label>{options.length ? <View style={styles.choices}>{options.map(option => <Pressable key={option.id} accessibilityRole="radio" accessibilityState={{ checked: selected === option.id, disabled }} disabled={disabled} onPress={() => choose(option.id)} style={[styles.choice, selected === option.id && styles.choiceSelected, disabled && styles.dim]}><Text style={[styles.choiceText, selected === option.id && styles.choiceSelectedText]}>{option.label}</Text></Pressable>)}</View> : <Text style={styles.body}>None available yet.</Text>}</View>;
}
function CompanySetup({ setup, busy }: { setup: (path: string, body: unknown, success?: string) => void; busy: boolean }) {
  const [name, setName] = useState(''), [invite, setInvite] = useState(''), [problem, setProblem] = useState('');
  const styles = useThemedStyles(makeStyles);
  return <><Card><SectionTitle>Create your company</SectionTitle><Text style={styles.body}>You’ll be the owner. Add a department, then invite your lead and team with the access they need.</Text><Field label="Company name" value={name} change={setName} disabled={busy} /><Button disabled={busy || !name.trim()} onPress={() => setup('/workspaces', { name: name.trim() }, 'Your company is ready. Add its first department.')}>Create company</Button></Card><Card><SectionTitle>Join with an invitation</SectionTitle><Field label="Invitation link" value={invite} change={setInvite} disabled={busy} />{problem && <Text style={styles.error}>{problem}</Text>}<Button disabled={busy || !invite.trim()} onPress={() => { try { const token = inviteToken(invite); setProblem(''); setup('/invites/' + encodeURIComponent(token) + '/accept', {}, 'You joined your company.'); } catch (e) { setProblem(message(e)); } }}>Join company</Button></Card></>;
}
type WorkflowProps = { snapshot: Snapshot; busy: boolean; confirm: (c: Confirmation) => void };
function Overview({ snapshot, busy, confirm, team }: WorkflowProps & { team: () => void }) {
  const styles = useThemedStyles(makeStyles), w = snapshot.workspace!, p = snapshot.pilot!, m = w.membership, manage = ['owner', 'finance'].includes(m.role);
  const [departmentId, setDepartment] = useState(w.departments[0]?.id || ''), [amount, setAmount] = useState('250'), [leadId, setLead] = useState('');
  const department = p.departments.find(d => d.id === departmentId), leads = w.people.filter(person => person.role === 'lead' && person.departmentId === departmentId), chosenLead = leads.find(l => l.id === leadId) || leads[0];
  const balance = manage ? p.treasury?.balance : p.departments.find(d => d.id === m.departmentId)?.balance;
  const held = p.requests.filter(r => r.status === 'held');
  return <>
    <Card><Label>{manage ? 'Company test treasury' : 'Department test budget'}</Label><Text style={styles.balance}>{money(balance)}</Text><Text style={styles.body}>Test dollars have no cash value. Payments and receipts are recorded on Tempo testnet.</Text>{manage && !p.ready && <Button disabled={busy} onPress={() => confirm({ title: 'Set up your test treasury', detail: 'Create this company’s isolated testnet treasury with 10,000 test dollars. This happens once for this company.', draft: { action: 'provision' } })}>Set up test treasury</Button>}</Card>
    {!w.departments.length && <Card><SectionTitle>Give your team a place to start.</SectionTitle><Text style={styles.body}>Add a department and invite its lead before assigning spending access.</Text><Button onPress={team}>Set up your team</Button></Card>}
    {p.departments.map(d => <Card key={d.id}><SectionTitle>{d.name}</SectionTitle><Text style={styles.balanceSmall}>{money(d.balance)}</Text><Text style={styles.body}>{d.headMembershipId ? `Delegated to ${w.people.find(person => person.id === d.headMembershipId)?.name || 'the assigned lead'}` : 'Waiting for Finance to delegate spending.'}</Text></Card>)}
    {manage && p.ready && w.departments.length > 0 && <Card><SectionTitle>Fund and delegate</SectionTitle><Choice label="Department" selected={departmentId} options={w.departments.map(d => ({ id: d.id, label: d.name }))} choose={id => { setDepartment(id); setLead(''); }} disabled={busy} /><Field label="Test dollars to add" value={amount} change={setAmount} numeric disabled={busy} /><Button disabled={busy || !positive(amount) || !departmentId || Number(amount) > (p.treasury?.balance || 0)} onPress={() => confirm({ title: `Add ${money(Number(amount))} to ${department?.name || 'department'}`, detail: 'These test dollars move from your company treasury into this department’s spending account.', draft: { action: 'fund', departmentId, amount: Number(amount) } })}>Add test funds</Button>{department?.headMembershipId ? <Button tone="plain" disabled={busy} onPress={() => confirm({ title: 'Remove spending delegation', detail: 'This removes the head’s on-chain authority. Revoke active cards first. Team access remains assigned separately.', draft: { action: 'undelegate', departmentId } })}>Remove head delegation</Button> : <><Choice label="Department lead" selected={chosenLead?.id || ''} options={leads.map(l => ({ id: l.id, label: l.name || l.title }))} choose={setLead} disabled={busy} /><Button disabled={busy || !chosenLead} onPress={() => confirm({ title: `Delegate to ${chosenLead?.name || 'your lead'}`, detail: 'This lead will be able to issue and revoke spending cards within this department. Finance retains control of the department budget.', draft: { action: 'delegate', departmentId, membershipId: chosenLead?.id } })}>Delegate spending</Button></>}</Card>}
    {(manage || m.role === 'lead') && <Card><SectionTitle>Requests to review</SectionTitle>{!held.length ? <Text style={styles.body}>No requests are waiting for your decision.</Text> : held.map(r => {
      const person = w.people.find(person => person.id === r.membershipId), self = person?.userId === snapshot.session.user?.id;
      const canApprove = !self && (manage || r.amount <= 1000);
      return <View key={r.id} style={styles.listRow}><Text style={styles.rowTitle}>{person?.name || 'Team member'} · {money(r.amount)}</Text><Text style={styles.body}>{p.vendors.find(v => v.id === r.vendorId)?.name} · {r.note}</Text><Text style={styles.fine}>{r.reason || 'Outside current card rules.'}</Text>{self ? <Text style={styles.fine}>Another approver must review your own request.</Text> : !canApprove ? <Text style={styles.fine}>Finance reviews requests above $1,000.</Text> : <Button disabled={busy} onPress={() => confirm({ title: `Approve ${money(r.amount)}`, detail: `Pay ${p.vendors.find(v => v.id === r.vendorId)?.name || 'this test vendor'} from the department budget for ${person?.name || 'this team member'}.`, draft: { action: 'approve', heldId: r.id } })}>Approve & pay test dollars</Button>}{!self && <Button tone="plain" disabled={busy} onPress={() => confirm({ title: 'Decline this request', detail: 'Record the decision without sending a payment.', draft: { action: 'decline', heldId: r.id } })}>Decline request</Button>}</View>;
    })}</Card>}
  </>;
}

function Spending({ snapshot, busy, confirm }: WorkflowProps) {
  const styles = useThemedStyles(makeStyles), w = snapshot.workspace!, p = snapshot.pilot!, m = w.membership, manage = ['owner', 'finance'].includes(m.role);
  const [departmentId, setDepartment] = useState(m.departmentId || w.departments[0]?.id || ''), [personId, setPerson] = useState(''), [cap, setCap] = useState('100'), [allowed, setAllowed] = useState<string[]>(p.vendors.slice(0, 1).map(v => v.id));
  const [cardId, setCard] = useState(''), [vendorId, setVendor] = useState(p.vendors[0]?.id || ''), [amount, setAmount] = useState('10'), [note, setNote] = useState('');
  const people = w.people.filter(person => person.departmentId === departmentId && ['lead', 'employee', 'contractor'].includes(person.role)), person = people.find(person => person.id === personId) || people[0];
  const ownCards = p.cards.filter(c => c.active && c.membershipId === m.id), card = ownCards.find(c => c.id === cardId) || ownCards[0];
  const delegated = p.departments.find(d => d.id === departmentId)?.headMembershipId === m.id;
  return <>
    {m.role === 'lead' && delegated && <Card><SectionTitle>Give someone spending access</SectionTitle><Text style={styles.body}>Set a 30-day cap and choose the test vendors this card can pay. The network enforces these rules.</Text><Choice label="Card holder" selected={person?.id || ''} options={people.map(person => ({ id: person.id, label: person.name || person.title }))} choose={setPerson} disabled={busy} /><Field label="30-day test dollar limit" value={cap} change={setCap} numeric disabled={busy} /><Label>Allowed test vendors</Label><View style={styles.choices}>{p.vendors.map(v => <Pressable key={v.id} accessibilityRole="checkbox" accessibilityState={{ checked: allowed.includes(v.id), disabled: busy }} disabled={busy} onPress={() => setAllowed(current => current.includes(v.id) ? current.filter(id => id !== v.id) : [...current, v.id])} style={[styles.choice, allowed.includes(v.id) && styles.choiceSelected]}><Text style={[styles.choiceText, allowed.includes(v.id) && styles.choiceSelectedText]}>{v.name}</Text></Pressable>)}</View><Button disabled={busy || !person || !positive(cap) || !allowed.length || p.cards.some(c => c.active && c.membershipId === person.id)} onPress={() => confirm({ title: `Issue a card to ${person?.name || 'this person'}`, detail: `${money(Number(cap))} per 30 days. Allowed vendors: ${p.vendors.filter(v => allowed.includes(v.id)).map(v => v.name).join(', ')}. Network fees count toward the limit.`, draft: { action: 'issue', departmentId, membershipId: person?.id, cap: Number(cap), allowedVendorIds: allowed } })}>Issue test spending card</Button></Card>}
    {m.role === 'lead' && !delegated && <Card><SectionTitle>Waiting for delegation</SectionTitle><Text style={styles.body}>Finance needs to delegate this department to you before you can issue spending cards.</Text></Card>}
    {manage && <Card><SectionTitle>Your leads issue cards.</SectionTitle><Text style={styles.body}>Fund a department and delegate its lead from Home. The lead can then issue cards with limits and allowed vendors.</Text></Card>}
    <Card><SectionTitle>{manage || m.role === 'lead' ? 'Department cards' : 'Your spending cards'}</SectionTitle>{!p.cards.length ? <Text style={styles.body}>No cards yet. Your department lead can issue your spending access.</Text> : p.cards.map(c => <View style={styles.listRow} key={c.id}><View style={styles.row}><Text style={styles.rowTitle}>{c.name || w.people.find(person => person.id === c.membershipId)?.name || 'Spending card'}</Text><Pill>{c.active ? 'Active' : 'Revoked'}</Pill></View><Text style={styles.balanceSmall}>{money(c.cap)} <Text style={styles.body}>/ 30 days</Text></Text><Text style={styles.body}>{p.vendors.filter(v => c.allowedVendorIds.includes(v.id)).map(v => v.name).join(' · ')}</Text>{c.active && (manage || m.role === 'lead') && <Button tone="plain" disabled={busy} onPress={() => confirm({ title: 'Revoke this spending card', detail: 'This stops further payments with this card and records revocation on Tempo testnet.', draft: { action: 'revoke', cardId: c.id } })}>Revoke card</Button>}</View>)}</Card>
    {ownCards.length > 0 && <Card><SectionTitle>Pay a test vendor</SectionTitle><Choice label="Your card" selected={card?.id || ''} options={ownCards.map(c => ({ id: c.id, label: `${c.name || 'Your card'} · ${money(c.cap)} limit` }))} choose={setCard} disabled={busy} /><Choice label="Test vendor" selected={vendorId} options={p.vendors.map(v => ({ id: v.id, label: v.name }))} choose={setVendor} disabled={busy} /><Field label="Test payment amount" value={amount} change={setAmount} numeric disabled={busy} /><Field label="What is this for?" value={note} change={setNote} multiline disabled={busy} />{card && !card.allowedVendorIds.includes(vendorId) && <Text style={styles.fine}>This vendor is outside your card’s rules. The payment will need approval.</Text>}<Button disabled={busy || !card || !vendorId || !positive(amount) || !note.trim()} onPress={() => confirm({ title: `Pay ${money(Number(amount))} in test dollars`, detail: `${p.vendors.find(v => v.id === vendorId)?.name || 'Test vendor'} · ${note.trim()}. If the card rules block it, your lead will receive an approval request.`, draft: { action: 'spend', cardId: card?.id, vendorId, amount: Number(amount), note: note.trim() } })}>Review test payment</Button><Text style={styles.fine}>Fees count toward your card limit. These are test vendor accounts, not real merchant purchases.</Text></Card>}
    {p.requests.filter(r => r.membershipId === m.id).map(r => <Card key={r.id}><View style={styles.row}><SectionTitle>{money(r.amount)}</SectionTitle><Pill>{r.status === 'held' ? 'Awaiting approval' : r.status === 'paid' ? 'Paid' : 'Declined'}</Pill></View><Text style={styles.body}>{r.note}</Text>{r.reason && <Text style={styles.fine}>{r.reason}</Text>}</Card>)}
  </>;
}

function Team({ snapshot, busy, setup, run, refresh, setNotice }: { snapshot: Snapshot; busy: boolean; setup: (path: string, body: unknown, success?: string) => void; run: (fn: () => Promise<void>) => Promise<void>; refresh: () => Promise<void>; setNotice: (s: string) => void }) {
  const styles = useThemedStyles(makeStyles), w = snapshot.workspace!, m = w.membership, manage = ['owner', 'finance'].includes(m.role);
  const [department, setDepartment] = useState(''), [name, setName] = useState(''), [title, setTitle] = useState(''), [role, setRole] = useState<Role>('employee'), [deptId, setDept] = useState(m.departmentId || w.departments[0]?.id || ''), [link, setLink] = useState(''), [showCompany, setShowCompany] = useState(false);
  return <>
    {manage && <Card><SectionTitle>Departments</SectionTitle>{w.departments.map(d => <Text style={styles.body} key={d.id}>{d.name}</Text>)}<Field label="New department name" value={department} change={setDepartment} disabled={busy} /><Button disabled={busy || !department.trim()} onPress={() => { setup('/departments', { workspaceId: w.workspace.id, name: department.trim() }, 'Department added. Invite its lead next.'); setDepartment(''); }}>Add department</Button></Card>}
    {(manage || m.role === 'lead') && <Card><SectionTitle>Invite your team</SectionTitle><Text style={styles.body}>A job title describes their work. Permission determines what they can do.</Text><Field label="Person’s name" value={name} change={setName} disabled={busy} /><Field label="Job title" value={title} change={setTitle} disabled={busy} /><Choice label="Assigned permission" selected={role} options={(manage ? ['finance', 'lead', 'employee', 'contractor'] : ['employee', 'contractor']).map(r => ({ id: r, label: labels[r as Role] }))} choose={id => setRole(id as Role)} disabled={busy} />{role !== 'finance' && <Choice label="Assigned department" selected={deptId} options={w.departments.map(d => ({ id: d.id, label: d.name }))} choose={setDept} disabled={busy || !manage} />}<Button disabled={busy || !name.trim() || !title.trim() || role !== 'finance' && !deptId} onPress={() => void run(async () => { const result = await pilotClient.setup('/invites', { workspaceId: w.workspace.id, name: name.trim(), title: title.trim(), role, departmentId: role === 'finance' ? undefined : deptId }); const next = new URL(result.inviteLink, pilotClient.base).href; setLink(next); setNotice('Invitation created. Share it privately with this person.'); await refresh(); })}>Create invitation</Button>{link && <><Text selectable style={styles.invite}>{link}</Text><Button tone="plain" onPress={() => void run(async () => { await Share.share({ message: `Join our Teampot company: ${link}`, url: link }); })}>Share invitation</Button><Text style={styles.fine}>This link can be used once. Anyone holding it can join with the assigned access.</Text></>}</Card>}
    <Card><SectionTitle>{manage || m.role === 'lead' ? 'People and access' : 'Your profile'}</SectionTitle>{w.people.map(person => <View key={person.id} style={styles.listRow}><Text style={styles.rowTitle}>{person.name}</Text><Text style={styles.body}>{person.title} · {labels[person.role]}</Text><Text style={styles.fine}>{w.departments.find(d => d.id === person.departmentId)?.name || 'Company-wide'}</Text>{manage && person.role !== 'owner' && person.userId !== snapshot.session.user?.id && <RemoveMember name={person.name || 'this person'} busy={busy} remove={() => setup('/members/' + person.id, { active: false }, 'Access removed.')} />}</View>)}</Card>
    {w.invites.length > 0 && (manage || m.role === 'lead') && <Card><SectionTitle>Invitations</SectionTitle>{w.invites.map(i => <View key={i.id} style={styles.listRow}><Text style={styles.rowTitle}>{i.name}</Text><Text style={styles.body}>{labels[i.role]} · {i.usedBy ? 'Accepted' : i.revoked ? 'Revoked' : i.expiresAt < Date.now() ? 'Expired' : 'Pending'}</Text>{!i.usedBy && !i.revoked && i.expiresAt > Date.now() && <Button tone="plain" disabled={busy} onPress={() => setup('/invites/' + i.id + '/revoke', {}, 'Invitation revoked.')}>Revoke invitation</Button>}</View>)}</Card>}
    <Button tone="plain" disabled={busy} onPress={() => setShowCompany(!showCompany)}>{showCompany ? 'Close company setup' : 'Create or join another company'}</Button>{showCompany && <CompanySetup setup={setup} busy={busy} />}
  </>;
}
function RemoveMember({ name, busy, remove }: { name: string; busy: boolean; remove: () => void }) {
  const [confirm, setConfirm] = useState(false), styles = useThemedStyles(makeStyles);
  return confirm ? <View style={styles.field}><Text style={styles.body}>Remove {name}’s company access? Revoke any active spending card or head delegation first.</Text><Button disabled={busy} onPress={() => { remove(); setConfirm(false); }}>Confirm removal</Button><Button tone="plain" disabled={busy} onPress={() => setConfirm(false)}>Keep access</Button></View> : <Button tone="plain" disabled={busy} onPress={() => setConfirm(true)}>Remove access</Button>;
}
function Activity({ snapshot, open }: { snapshot: Snapshot; open: (tx: string) => void }) {
  const styles = useThemedStyles(makeStyles), p = snapshot.pilot!, w = snapshot.workspace!;
  return <><Card><SectionTitle>Testnet receipts</SectionTitle>{!p.receipts.length ? <Text style={styles.body}>Your confirmed activity will appear here after the first test action.</Text> : [...p.receipts].reverse().map(r => <Pressable key={r.id} accessibilityRole="link" onPress={() => open(r.tx)} style={styles.listRow}><View style={styles.row}><Text style={styles.rowTitle}>{r.kind.replace(/[_-]/g, ' ')}</Text>{r.amount != null && <Text style={styles.rowTitle}>{money(r.amount)}</Text>}</View><Text style={styles.fine}>{new Date(r.at).toLocaleString()}</Text><Text style={styles.link}>View Tempo receipt ↗</Text></Pressable>)}</Card>{p.operations.filter(o => !['confirmed', 'held'].includes(o.status)).map(o => <Card key={o.id}><SectionTitle>{o.action}</SectionTitle><Pill>{o.status}</Pill>{o.error && <Text style={styles.body}>{o.error}</Text>}{o.tx && <Button tone="plain" onPress={() => open(o.tx!)}>View transaction</Button>}</Card>)}{w.audit.length > 0 && <Card><SectionTitle>Access activity</SectionTitle>{[...w.audit].map(a => <View key={a.id} style={styles.listRow}><Text style={styles.body}>{a.action}</Text><Text style={styles.fine}>{new Date(a.at).toLocaleString()}</Text></View>)}</Card>}</>;
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.paper }, top: { paddingHorizontal: 24, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line }, brand: { flexDirection: 'row', gap: 9, alignItems: 'center' }, wordmark: { fontFamily: 'Geist_500Medium', fontSize: 23, letterSpacing: -1, color: c.ink },
  content: { paddingHorizontal: 22, paddingTop: 24, gap: 18, width: '100%', maxWidth: 640, alignSelf: 'center' }, welcome: { paddingVertical: 80, gap: 20 }, hero: { borderRadius: 30, paddingHorizontal: 24, paddingVertical: 42, minHeight: 360, gap: 24, borderWidth: 1, borderColor: c.edge }, welcomeTitle: { fontSize: 44, lineHeight: 47, letterSpacing: -1.8, fontFamily: 'Geist_300Light', color: c.ink }, heroCopy: { fontSize: 17, lineHeight: 25, fontFamily: 'Geist_400Regular', color: c.muted, maxWidth: 390 }, eyebrow: { fontFamily: 'Geist_500Medium', fontSize: 11, letterSpacing: 1.3, color: c.muted }, title: { fontFamily: 'Geist_300Light', fontSize: 36, lineHeight: 41, letterSpacing: -1, color: c.ink }, body: { fontFamily: 'Geist_400Regular', fontSize: 15, lineHeight: 22, color: c.muted }, fine: { fontFamily: 'Geist_400Regular', fontSize: 12, lineHeight: 18, color: c.muted }, link: { fontFamily: 'Geist_500Medium', color: c.clayDark, fontSize: 14, paddingVertical: 6 }, centerLink: { fontFamily: 'Geist_500Medium', color: c.clayDark, fontSize: 14, paddingVertical: 10, textAlign: 'center' }, dots: { flexDirection: 'row', gap: 10, marginTop: 14 }, dot: { width: 24, height: 8, borderRadius: 4, backgroundColor: c.line }, dotActive: { backgroundColor: c.clay }, code: { fontSize: 34, letterSpacing: 4, textAlign: 'center', fontFamily: 'Geist_500Medium', color: c.ink, paddingVertical: 20 }, field: { gap: 8 }, input: { color: c.ink, fontFamily: 'Geist_400Regular', fontSize: 16, backgroundColor: c.elevated, borderColor: c.line, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, minHeight: 50, paddingVertical: 12 }, multiline: { minHeight: 88, textAlignVertical: 'top' }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, choice: { borderWidth: 1, borderColor: c.line, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 13, minHeight: 44, justifyContent: 'center' }, choiceSelected: { backgroundColor: c.ink, borderColor: c.ink }, choiceText: { fontFamily: 'Geist_400Regular', color: c.ink, fontSize: 14 }, choiceSelectedText: { color: c.paper }, dim: { opacity: 0.55 }, balance: { fontFamily: 'Geist_300Light', fontSize: 46, letterSpacing: -1.5, color: c.ink }, balanceSmall: { fontFamily: 'Geist_400Regular', fontSize: 25, letterSpacing: -0.5, color: c.ink }, row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, rowTitle: { color: c.ink, fontSize: 16, fontFamily: 'Geist_500Medium' }, listRow: { paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.line, gap: 9 }, errorBox: { padding: 14, borderRadius: 14, backgroundColor: c.errorSurface, borderColor: c.errorLine, borderWidth: 1, gap: 6 }, error: { color: c.error, fontFamily: 'Geist_400Regular', fontSize: 14, lineHeight: 21 }, noticeBox: { padding: 14, borderRadius: 14, backgroundColor: c.successSurface, borderColor: c.successLine, borderWidth: 1 }, tabs: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 10, gap: 4, backgroundColor: c.soft, borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.line }, tab: { flex: 1, alignItems: 'center', minHeight: 46, justifyContent: 'center', borderRadius: 14 }, selectedTab: { backgroundColor: c.ink }, tabText: { fontFamily: 'Geist_500Medium', color: c.muted, fontSize: 13 }, selectedTabText: { color: c.paper }, modalOverlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'center', padding: 22 }, modalCard: { padding: 24, backgroundColor: c.soft, borderColor: c.edge, borderWidth: 1, borderRadius: 26, gap: 18, maxWidth: 520, width: '100%', alignSelf: 'center' }, invite: { color: c.ink, fontFamily: 'Geist_400Regular', fontSize: 13, lineHeight: 20 }
});
