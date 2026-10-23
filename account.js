import { useEffect, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Heading, Loading, Notice, Panel, Screen, colors, ui } from '../../components/UI';
import { useAuth } from '../../context/AuthContext';

export default function AccountScreen() {
  const { user, ready, signOut } = useAuth();
  const [error, setError] = useState('');
  useEffect(() => { if (!user) setError(''); }, [user]);

  if (!ready) return <Screen><Loading /></Screen>;
  if (!user) return (
    <Screen>
      <Heading eyebrow="YOUR ACCOUNT" title="Welcome to DERASHE GERAJI" subtitle="Sign in to manage bookings, vehicles, and roadside requests." />
      <Button title="Log in" onPress={() => router.push('/login')} />
      <Button title="Create an account" secondary onPress={() => router.push('/register')} />
    </Screen>
  );

  return (
    <Screen>
      <Heading eyebrow="YOUR ACCOUNT" title={user.name} subtitle={`Signed in as ${user.role}.`} />
      <Panel>
        <View style={ui.row}><Text style={ui.muted}>Email</Text><Text style={{ color: colors.ink, flexShrink: 1 }}>{user.email}</Text></View>
        <View style={ui.row}><Text style={ui.muted}>Phone</Text><Text style={{ color: colors.ink }}>{user.phone}</Text></View>
        {user.phone ? <Button title="Call my phone" secondary icon={<Ionicons name="call-outline" size={17} color={colors.green} />} onPress={() => Linking.openURL(`tel:${user.phone}`)} /> : null}
      </Panel>
      <Link href="/vehicles" asChild><Button title="My vehicles" secondary icon={<Ionicons name="car-outline" size={18} color={colors.green} />} /></Link>
      <Notice message={error} />
      <Button title="Sign out" secondary onPress={() => signOut().catch((reason) => setError(reason.message))} />
    </Screen>
  );
}