import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, AppState, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTeampot } from '@/TeampotProvider';
import { normalizeBetaName } from '@/betaProfile';
import { useTheme, ThemeColors } from '@/theme';
import { BrandLogo } from './BrandLogo';

const slides = [
  { title: 'Good work.\nMoney in sync.', detail: 'Team spending, approvals and pay.\nA little more together.' },
  { title: 'Know your budget.\nMake your move.', detail: 'See what’s available. Ask for what you need.\nKeep the work moving.' },
  { title: 'Less chasing.\nMore creating.', detail: 'Send an invoice or review a request.\nKnow where things stand.' },
];
const roles = [
  { id: 'sam', role: 'Team member', detail: 'Manage your work spending', icon: 'wallet-outline' },
  { id: 'ava', role: 'Department lead', detail: 'Keep your team moving', icon: 'people-outline' },
  { id: 'mateo', role: 'Contractor', detail: 'Send invoices and follow your pay', icon: 'document-text-outline' },
  { id: 'jordan', role: 'Finance', detail: 'Look after budgets and payday', icon: 'pie-chart-outline' },
] as const;

function useGentleMotion() {
  // Start still until the system preference has been read.
  const [reduced, setReduced] = useState(true);
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    let live = true;
    const media = Platform.OS === 'web' && typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const updateWeb = () => setReduced(media?.matches ?? true);
    if (media) { updateWeb(); media.addEventListener('change', updateWeb); }
    else void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (live) setReduced(value); }).catch(() => {});
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    const app = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => { live = false; motion.remove(); app.remove(); media?.removeEventListener('change', updateWeb); };
  }, []);
  return { reduced, active };
}

function WelcomeArt({ page, reduced, active, compact }: { page: number; reduced: boolean; active: boolean; compact: boolean }) {
  const { colors: c, isDark } = useTheme();
  const drift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    drift.setValue(0);
    if (reduced || !active) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(drift, { toValue: 1, duration: 3600, useNativeDriver: true }),
      Animated.timing(drift, { toValue: 0, duration: 3600, useNativeDriver: true }),
    ]));
    animation.start(); return () => animation.stop();
  }, [drift, reduced, active]);
  const s = makeStyles(c);
  return <View testID="welcome-art" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden style={[s.art, compact && { height: 218 }]}>
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
      <Defs><RadialGradient id="welcomeGlow" cx="52%" cy="48%" rx="53%" ry="50%"><Stop offset="0" stopColor={c.clay} stopOpacity={isDark ? 0.23 : 0.17} /><Stop offset="0.55" stopColor={c.clay} stopOpacity={0.06} /><Stop offset="1" stopColor={c.clay} stopOpacity={0} /></RadialGradient></Defs>
      <Rect width="100%" height="100%" fill="url(#welcomeGlow)" />
    </Svg>
    <Animated.View style={[s.artGroup, { transform: [{ translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [3, -5] }) }, { rotate: page === 0 ? '-6deg' : page === 1 ? '-3deg' : '3deg' }] }]}>
      <View style={[s.backPlate, { backgroundColor: c.tint, borderColor: c.tintLine }]} />
      <LinearGradient colors={isDark ? ['#62625E', '#252523', '#4C3830'] : ['#FFFFFF', '#DEDAD1', '#FFFFFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.artEdge}>
        <BlurView intensity={22} tint={isDark ? 'dark' : 'light'} style={[s.artCard, { backgroundColor: isDark ? '#1B1B19E6' : '#FFFDF9DC' }]}>
          <View style={s.artTop}><BrandLogo size={34} reversed={isDark} /><Text style={s.artBrand}>teampot</Text><View style={[s.artDot, { backgroundColor: c.clay }]} /></View>
          {page === 0 ? <><Text style={s.artLabel}>A place for your team</Text><Text style={s.artHeadline}>All together.</Text><View style={s.teamLine}>{['K', 'A', 'M'].map((initial, i) => <View key={initial} style={[s.avatar, { backgroundColor: i === 1 ? c.ink : c.tint, marginLeft: i ? -7 : 0 }]}><Text style={{ color: i === 1 ? c.paper : c.clayDark, fontSize: 16 }}>{initial}</Text></View>)}<Text style={s.teamCaption}>One shared rhythm</Text></View></> : page === 1 ? <><Text style={s.artLabel}>Your work budget · Example</Text><Text style={s.artHeadline}>$450<Text style={s.artDecimal}> available</Text></Text><View style={s.budgetTrack}><View style={[s.budgetFill, { backgroundColor: c.clay }]} /></View><View style={s.budgetFooter}><Text style={s.artCaption}>Room for what’s next</Text><Ionicons name="arrow-up-right-box-outline" color={c.muted} size={18} /></View></> : <><Text style={s.artLabel}>Your latest invoice · Example</Text><Text style={s.artHeadline}>Design, delivered.</Text><View style={s.invoiceRule} /><View style={s.budgetFooter}><Text style={s.artCaption}>Sent to your team</Text><View style={s.status}><View style={[s.statusDot, { backgroundColor: c.success }]} /><Text style={[s.statusText, { color: c.success }]}>In review</Text></View></View></>}
        </BlurView>
      </LinearGradient>
      <View style={[s.floatingTag, { backgroundColor: c.soft, borderColor: c.edge }]}><Ionicons name={page === 0 ? 'people-outline' : page === 1 ? 'checkmark' : 'paper-plane-outline'} size={18} color={c.clayDark} /><Text style={s.tagText}>{page === 0 ? 'Made for your team' : page === 1 ? 'Clarity feels good' : 'One less follow-up'}</Text></View>
    </Animated.View>
  </View>;
}

export function BetaEntry() {
  const { completeOnboarding, sessionStatus, loading, error } = useTeampot();
  const { colors: c, isDark } = useTheme();
  const s = makeStyles(c);
  const { height } = useWindowDimensions();
  const compact = height < 740;
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [nameError, setNameError] = useState('');
  const [focused, setFocused] = useState(false);
  const motion = useGentleMotion();
  const entrance = useRef(new Animated.Value(1)).current;
  const input = useRef<TextInput>(null);
  const scroll = useRef<ScrollView>(null);
  let validName = false;
  try { normalizeBetaName(name); validName = true; } catch {}
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
    entrance.setValue(motion.reduced ? 1 : 0);
    const animation = Animated.timing(entrance, { toValue: 1, duration: 360, useNativeDriver: true });
    if (!motion.reduced) animation.start();
    return () => animation.stop();
  }, [step, motion.reduced, entrance]);
  useEffect(() => {
    if (sessionStatus === 'restoring' || Platform.OS === 'web') return;
    const heading = step < 3 ? slides[step].title.replace('\n', ' ') : step === 3 ? 'What’s your name?' : 'What’s your role?';
    AccessibilityInfo.announceForAccessibility(heading);
  }, [step, sessionStatus]);
  function next() {
    if (loading) return;
    if (step < 3) { setStep(step + 1); return; }
    if (step === 3) {
      try { setName(normalizeBetaName(name)); setNameError(''); Keyboard.dismiss(); setStep(4); }
      catch (e) { setNameError(e instanceof Error ? e.message : 'Add your name to continue.'); input.current?.focus(); }
      return;
    }
    if (selected) void completeOnboarding(name, selected);
  }
  if (sessionStatus === 'restoring') return <SafeAreaView style={s.safe}><View style={s.restore}><BrandLogo size={80} reversed={isDark} /><ActivityIndicator accessibilityLabel="Restoring session" color={c.clayDark} /></View></SafeAreaView>;
  const intro = step < 3;
  const actionLabel = loading ? 'Making yourself at home…' : step === 2 ? 'Make it yours' : step === 4 ? 'Let’s get started' : 'Continue';
  return <SafeAreaView testID="onboarding" style={s.safe}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.flex}>
      <View style={s.topBar}>
        {step > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="Go back" disabled={loading} onPress={() => { Keyboard.dismiss(); setStep(step - 1); }} style={s.back}><Ionicons name="arrow-back" color={c.ink} size={23} /></Pressable> : <View style={s.brand}><BrandLogo size={38} reversed={isDark} /><Text style={s.wordmark}>teampot</Text></View>}
        {intro ? <Pressable accessibilityRole="button" onPress={() => setStep(3)} style={s.skip}><Text style={s.smallText}>Skip intro</Text></Pressable> : <Text style={s.stepText}>{step === 3 ? '01' : '02'} <Text style={{ color: c.muted }}> / 02</Text></Text>}
      </View>
      <ScrollView ref={scroll} contentContainerStyle={[s.content, !intro && s.formContent, step === 4 && compact && { paddingTop: 18 }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Animated.View style={[s.stage, { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
          {intro ? <>
            <WelcomeArt page={step} compact={compact} reduced={motion.reduced} active={motion.active} />
            <View style={s.introCopy}><Text accessibilityRole="header" style={s.title}>{slides[step].title}</Text><Text style={s.description}>{slides[step].detail}</Text></View>
          </> : step === 3 ? <>
            <View style={s.nameIcon}><Ionicons name="hand-left-outline" color={c.clayDark} size={31} /></View>
            <Text accessibilityRole="header" style={s.title}>{'First things first.\nWhat’s your name?'}</Text>
            <Text style={s.description}>Something we can call you. A first name or nickname is perfect.</Text>
            <View style={s.nameField}>
              <Text nativeID="name-label" style={s.fieldLabel}>Your name</Text>
              <View style={[s.inputEdge, focused && { borderColor: c.clayDark }]}><TextInput ref={input} accessibilityLabel="Your name" accessibilityHint="Your name stays on this device for the beta." placeholder="e.g. Alex" placeholderTextColor={c.muted} value={name} onChangeText={value => { setName(value); setNameError(''); }} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} autoCapitalize="words" autoCorrect={false} textContentType="givenName" autoComplete="given-name" maxLength={40} returnKeyType="next" onSubmitEditing={next} selectionColor={c.clay} style={s.input} /></View>
              <Text style={s.privacyNote}><Ionicons name="lock-closed-outline" size={12} />  Saved only on this device.</Text>
              {nameError ? <Text accessibilityRole="alert" style={s.error}>{nameError}</Text> : null}
            </View>
          </> : <>
            <Text accessibilityRole="header" style={s.title}>What’s your role?</Text>
            <Text style={s.description}>Hi {name}. We’ll start with the screens that matter to you.</Text>
            <View accessibilityRole="radiogroup" accessibilityLabel="Your role" style={s.roles}>{roles.map(role => <Pressable key={role.id} accessibilityRole="radio" accessibilityLabel={role.role} accessibilityState={{ checked: selected === role.id, disabled: loading }} disabled={loading} onPress={() => setSelected(role.id)} style={({ pressed }) => [s.role, compact && { minHeight: 72, paddingVertical: 10 }, selected === role.id && s.selectedRole, pressed && { opacity: 0.8 }]}><View style={s.roleIcon}><Ionicons name={role.icon} size={23} color={selected === role.id ? c.clayDark : c.muted} /></View><View style={s.roleCopy}><Text style={s.roleName}>{role.role}</Text><Text style={s.roleDetail}>{role.detail}</Text></View><Ionicons name={selected === role.id ? 'checkmark-circle' : 'ellipse-outline'} size={23} color={selected === role.id ? c.clayDark : c.line} /></Pressable>)}</View>
            <Text style={s.betaNote}>For this beta, your role opens a shared test workspace. Use test details only. Real team access will come from an invitation.</Text>
            {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
          </>}
        </Animated.View>
      </ScrollView>
      <View style={s.footer}>
        {intro ? <View accessibilityLabel={`Introduction ${step + 1} of 3`} style={s.pagination}>{slides.map((_, i) => <View key={i} style={[s.pageDot, { backgroundColor: i === step ? c.ink : c.line, width: i === step ? 24 : 6 }]} />)}</View> : null}
        <Pressable accessibilityRole="button" accessibilityLabel={actionLabel} accessibilityState={{ disabled: loading || (step === 3 && !validName) || (step === 4 && !selected) }} disabled={loading || (step === 3 && !validName) || (step === 4 && !selected)} onPress={next} style={({ pressed }) => [s.primary, (loading || (step === 3 && !validName) || (step === 4 && !selected)) && s.disabled, pressed && { opacity: 0.85 }]}><Text style={s.primaryText}>{actionLabel}</Text>{loading ? <ActivityIndicator size="small" color={c.paper} /> : <Ionicons name="arrow-forward" size={20} color={c.paper} />}</Pressable>
        <Text style={s.footerNote}>{intro ? 'A little less friction. A lot more flow.' : step === 3 ? 'Your team. Your space.' : 'Private beta · Test funds only'}</Text>
      </View>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  flex: { flex: 1 }, safe: { flex: 1, backgroundColor: c.paper }, restore: { flex: 1, gap: 28, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 6, minHeight: 60, width: '100%', maxWidth: 560, alignSelf: 'center' },
  brand: { flexDirection: 'row', gap: 4, alignItems: 'center' }, wordmark: { color: c.ink, fontFamily: 'Geist_300Light', fontSize: 24, letterSpacing: -0.8 }, back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -10 }, skip: { minHeight: 44, justifyContent: 'center', paddingLeft: 12 }, smallText: { color: c.muted, fontSize: 13, fontFamily: 'Geist_400Regular' }, stepText: { color: c.ink, fontFamily: 'Geist_400Regular', fontSize: 13 },
  content: { flexGrow: 1, paddingHorizontal: 28, paddingBottom: 16, maxWidth: 560, width: '100%', alignSelf: 'center', justifyContent: 'center' }, formContent: { paddingTop: 38, justifyContent: 'flex-start' }, stage: { width: '100%' }, introCopy: { marginTop: 14 },
  title: { fontFamily: 'Geist_300Light', color: c.ink, fontSize: 39, lineHeight: 45, letterSpacing: -1.2 }, description: { fontSize: 15, color: c.muted, lineHeight: 23, fontFamily: 'Geist_400Regular', marginTop: 17 },
  art: { height: 288, marginHorizontal: -16, alignItems: 'center', justifyContent: 'center' }, artGroup: { width: '87%', maxWidth: 310 }, artEdge: { padding: 1, borderRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.09, shadowRadius: 24 }, artCard: { borderRadius: 23, overflow: 'hidden', padding: 22, minHeight: 200 }, backPlate: { position: 'absolute', top: -12, bottom: 14, left: 16, right: -8, borderRadius: 24, borderWidth: 1, transform: [{ rotate: '7deg' }] },
  artTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 }, artBrand: { fontFamily: 'Geist_300Light', color: c.ink, fontSize: 17 }, artDot: { width: 6, height: 6, borderRadius: 3, marginLeft: 'auto' }, artLabel: { color: c.muted, fontSize: 10, fontFamily: 'Geist_400Regular', marginBottom: 8 }, artHeadline: { color: c.ink, fontFamily: 'Geist_300Light', fontSize: 25, letterSpacing: -0.8 }, artDecimal: { fontSize: 11, letterSpacing: 0, color: c.muted }, artCaption: { color: c.muted, fontSize: 10, fontFamily: 'Geist_400Regular' },
  teamLine: { flexDirection: 'row', alignItems: 'center', marginTop: 22 }, avatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: c.soft, alignItems: 'center', justifyContent: 'center' }, teamCaption: { fontSize: 10, color: c.muted, marginLeft: 10, fontFamily: 'Geist_400Regular' }, budgetTrack: { height: 5, borderRadius: 4, backgroundColor: c.line, marginTop: 24, overflow: 'hidden' }, budgetFill: { width: '75%', height: 5, borderRadius: 4 }, budgetFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }, invoiceRule: { height: 1, backgroundColor: c.line, marginTop: 22 }, status: { flexDirection: 'row', alignItems: 'center', gap: 4 }, statusDot: { height: 4, width: 4, borderRadius: 2 }, statusText: { fontSize: 9, fontFamily: 'Geist_400Regular' },
  floatingTag: { position: 'absolute', bottom: -21, right: -9, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, paddingHorizontal: 18, borderRadius: 16, borderWidth: 1, transform: [{ rotate: '6deg' }], shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } }, tagText: { color: c.ink, fontSize: 11, fontFamily: 'Geist_500Medium' },
  nameIcon: { width: 72, height: 72, borderRadius: 23, backgroundColor: c.tint, borderColor: c.tintLine, borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginBottom: 36 }, nameField: { marginTop: 40, gap: 12 }, fieldLabel: { color: c.ink, fontSize: 14, fontFamily: 'Geist_500Medium' }, inputEdge: { borderWidth: 1, borderColor: c.line, backgroundColor: c.soft, borderRadius: 18, overflow: 'hidden' }, input: { minHeight: 68, color: c.ink, paddingHorizontal: 18, paddingVertical: 15, fontFamily: 'Geist_300Light', fontSize: 25 }, privacyNote: { color: c.muted, fontSize: 12, lineHeight: 18, fontFamily: 'Geist_400Regular' },
  roles: { marginTop: 30, gap: 10 }, role: { minHeight: 80, borderWidth: 1, borderColor: c.line, borderRadius: 18, flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, backgroundColor: c.soft }, selectedRole: { borderColor: c.clayDark, backgroundColor: c.tint }, roleIcon: { width: 31, alignItems: 'center' }, roleCopy: { flex: 1, gap: 5 }, roleName: { color: c.ink, fontSize: 16, fontFamily: 'Geist_500Medium' }, roleDetail: { color: c.muted, fontSize: 11, lineHeight: 16, fontFamily: 'Geist_400Regular' }, betaNote: { color: c.muted, fontSize: 12, lineHeight: 18, fontFamily: 'Geist_400Regular', marginTop: 23 }, error: { color: c.error, fontSize: 14, lineHeight: 21, marginTop: 12 },
  footer: { paddingHorizontal: 28, paddingTop: 12, paddingBottom: 12, width: '100%', maxWidth: 560, alignSelf: 'center', gap: 16 }, pagination: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }, pageDot: { height: 6, borderRadius: 3 }, primary: { minHeight: 58, borderRadius: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: c.ink, paddingHorizontal: 23, paddingVertical: 15 }, primaryText: { color: c.paper, fontSize: 16, fontFamily: 'Geist_500Medium', flexShrink: 1 }, disabled: { opacity: 0.4 }, footerNote: { color: c.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', fontFamily: 'Geist_400Regular' },
});
