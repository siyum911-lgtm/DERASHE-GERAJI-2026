import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { Button, Field, Heading, Notice, Panel, Screen, colors, ui } from './UI';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function AuthScreen({ mode }) {
  const isLogin = mode === 'login';
  const { signIn } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', role: 'customer', businessName: '', providerType: 'mechanic', location: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const payload = isLogin
        ? { email: form.email.trim(), password: form.password }
        : form.role === 'customer'
          ? { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), password: form.password, role: 'customer' }
          : { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), password: form.password, role: 'provider', businessName: form.businessName.trim(), providerType: form.providerType, location: form.location.trim() };
      await signIn(await apiRequest(`/auth/${isLogin ? 'login' : 'register'}`, { method: 'POST', body: payload }));
      router.replace('/(tabs)/account');
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ gap: 17 }}>
          <Heading eyebrow="DERASHE GERAJI" title={isLogin ? 'Welcome back' : 'Create your account'} subtitle={isLogin ? 'Sign in to manage your vehicle services.' : 'Join drivers and automotive service providers.'} />
          <Panel>
            {!isLogin ? <>
              <View style={{ gap: 8 }}>
                <Text style={ui.sectionTitle}>Account type</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {['customer', 'provider'].map((role) => <Button key={role} title={role === 'customer' ? 'Vehicle owner' : 'Mechanic / shop'} secondary={form.role !== role} onPress={() => set('role', role)} style={{ flex: 1, paddingHorizontal: 8 }} />)}
                </View>
              </View>
              {form.role === 'provider' ? <>
                <Field label="Business or workshop name" value={form.businessName} onChangeText={(value) => set('businessName', value)} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {['mechanic', 'workshop'].map((type) => <Button key={type} title={type === 'mechanic' ? 'Mechanic' : 'Workshop'} secondary={form.providerType !== type} onPress={() => set('providerType', type)} style={{ flex: 1 }} />)}
                </View>
                <Field label="City or area" value={form.location} onChangeText={(value) => set('location', value)} />
                <Text style={ui.muted}>Provider listings require administrator verification before services become visible.</Text>
              </> : null}
              <Field label="Full name" value={form.name} onChangeText={(value) => set('name', value)} autoCapitalize="words" />
              <Field label="Phone number" value={form.phone} onChangeText={(value) => set('phone', value)} keyboardType="phone-pad" />
            </> : null}
            <Field label="Email address" value={form.email} onChangeText={(value) => set('email', value)} keyboardType="email-address" autoCapitalize="none" />
            <Field label="Password" value={form.password} onChangeText={(value) => set('password', value)} secureTextEntry autoCapitalize="none" />
            {!isLogin ? <Text style={ui.muted}>Use at least 8 characters.</Text> : null}
            <Notice message={error} />
            <Button title={busy ? 'Please wait…' : isLogin ? 'Log in' : 'Create account'} onPress={submit} disabled={busy || !form.email || !form.password || (!isLogin && (!form.name || !form.phone || (form.role === 'provider' && (!form.businessName || !form.location))))} />
          </Panel>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: colors.muted }}>{isLogin ? 'New to DERASHE GERAJI?' : 'Already have an account?'} </Text>
            <Link href={isLogin ? '/register' : '/login'} style={{ color: colors.green, fontWeight: '800', padding: 8 }}>{isLogin ? 'Create an account' : 'Log in'}</Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}