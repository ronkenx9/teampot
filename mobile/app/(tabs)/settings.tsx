import { useThemedStyles, type ThemeColors } from '@/theme';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import Constants from 'expo-constants';
import { useTeampot } from '@/TeampotProvider';
import { Shell } from '@/components/Shell';
import { Button, Card, Label, SectionTitle } from '@/components/ui';
import { api } from '@/api';
export default function Settings() {
  const styles = useThemedStyles(makeStyles);
  const { state, loading, signOut, betaProfile } = useTeampot();
  const [message, setMessage] = useState('');
  return <Shell title="Settings">
    <Card><SectionTitle>Your profile</SectionTitle><View style={styles.row}><Label>Name on this device</Label><Text style={styles.value}>{betaProfile?.name || 'Tester'}</Text></View><Text style={styles.body}>Your name personalizes this beta. The test workspace uses a shared demo account; your name doesn’t change its records or access.</Text></Card>
    <Card><SectionTitle>About this beta</SectionTitle><Text style={styles.body}>You’re exploring a shared demo company on Tempo testnet. Transactions use test funds. Demo roles are available to every tester.</Text><View style={styles.row}><Label>Version</Label><Text style={styles.value}>{Constants.expoConfig?.version || '0.1.0'}</Text></View><View style={styles.row}><Label>Shared demo account</Label><Text style={styles.value}>{state?.people.find(p => p.id === state.auth?.personId)?.name || 'Demo account'}</Text></View></Card>
    <Card><SectionTitle>What’s available</SectionTitle><Text style={styles.body}>Work budgets, vendor payments, approvals, contractor invoices and Finance payday.</Text><Text style={styles.body}>Live earning and private payroll aren’t available in this beta. Investment controls use test shares and delayed prices.</Text></Card>
    <Card><SectionTitle>Your real company</SectionTitle><Text style={styles.body}>Real passkey accounts and company setup currently live on the web. They are separate from these demo accounts, and payment accounts are not connected.</Text><Button tone="plain" onPress={() => { void Linking.openURL('https://teampot.vercel.app/app').catch(() => setMessage('Open teampot.vercel.app/app in your browser.')); }}>Open company setup</Button></Card>
    <Card><SectionTitle>Testing feedback</SectionTitle><Text style={styles.body}>Share the screen name, steps and a screenshot with the person who invited you. Leave out payment details and personal information.</Text><Label>Connected service</Label><Text selectable style={styles.endpoint}>{api.base}</Text></Card>
    {message ? <Text accessibilityRole="alert" style={styles.body}>{message}</Text> : null}
    <Button tone="plain" disabled={loading} onPress={() => void signOut()}>Sign out of beta</Button>
  </Shell>;
}
const makeStyles = (colors: ThemeColors) => StyleSheet.create({ body: { color: colors.muted, fontFamily: 'Geist_400Regular', fontSize: 15, lineHeight: 23 }, row: { flexDirection: 'row', gap: 12, justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line }, value: { color: colors.ink, fontSize: 14, fontFamily: 'Geist_500Medium', flexShrink: 1 }, endpoint: { color: colors.muted, fontSize: 12, fontFamily: 'Geist_400Regular' } });
