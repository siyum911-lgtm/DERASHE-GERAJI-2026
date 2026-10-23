import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Heading, Notice, Panel, Screen, colors, ui } from '../../components/UI';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';
import { dateTime, money } from '../../lib/format';

const nextStatus = (status, role) => {
  if (role === 'customer') return status === 'Pending' ? ['Cancelled'] : [];
  if (status === 'Pending') return ['Accepted', 'Rejected'];
  if (status === 'Accepted') return ['Scheduled', 'In Progress'];
  if (status === 'Scheduled') return ['In Progress'];
  if (status === 'In Progress') return ['Completed'];
  return [];
};

export default function BookingsScreen() {
  const { user, token, ready } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (!token) { setLoading(false); return; }
    if (refresh) setRefreshing(true); else setLoading(true);
    setError('');
    try { setBookings(await apiRequest('/bookings', { token })); }
    catch (reason) { setError(reason.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, [token]);

  useEffect(() => { if (ready) load(); }, [load, ready]);

  const update = async (booking, status) => {
    try {
      const result = await apiRequest(`/bookings/${booking.id}/status`, { method: 'PATCH', token, body: { status } });
      setBookings((items) => items.map((item) => item.id === booking.id ? { ...item, ...result } : item));
    } catch (reason) { setError(reason.message); }
  };

  if (!ready) return <Screen><ActivityIndicator color={colors.green} style={{ marginTop: 60 }} /></Screen>;
  if (!user) return <Screen><Heading title="My bookings" subtitle="Sign in to follow your repair requests." /><Button title="Log in" onPress={() => router.push('/login')} /><Button title="Browse services" secondary onPress={() => router.push('/(tabs)/services')} /></Screen>;

  return (
    <Screen>
      <Heading eyebrow="REPAIR PROGRESS" title={user.role === 'customer' ? 'My bookings' : 'Booking requests'} subtitle="Follow each repair from request to completion." />
      <Notice message={error} />
      {loading ? <ActivityIndicator color={colors.green} style={{ marginTop: 45 }} /> : <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}><Button title={refreshing ? 'Refreshing…' : 'Refresh'} secondary disabled={refreshing} onPress={() => load(true)} /></View>
        {bookings.length === 0 ? <Panel><Text style={ui.muted}>No bookings yet.</Text>{user.role === 'customer' ? <Button title="Find a service" onPress={() => router.push('/(tabs)/services')} /> : null}</Panel> : bookings.map((booking) => <Panel key={booking.id}>
          <View style={ui.row}><Text style={{ color: colors.navy, fontSize: 15, fontWeight: '800' }}>Booking #{booking.id}</Text><Text style={ui.badge}>{booking.status}</Text></View>
          <Text style={{ color: colors.ink, fontWeight: '700' }}>{booking.year} {booking.make} {booking.model} · {booking.service_name}</Text>
          <Text style={ui.muted}>{user.role === 'customer' ? booking.business_name : booking.customer_name}</Text>
          <View style={ui.row}><Text style={ui.muted}>{dateTime(booking.scheduled_at)}</Text><Text style={{ color: colors.green, fontWeight: '800' }}>{money(booking.estimate)}</Text></View>
          {nextStatus(booking.status, user.role).length ? <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>{nextStatus(booking.status, user.role).map((status) => <Button key={status} title={status} secondary={status === 'Rejected' || status === 'Cancelled'} onPress={() => update(booking, status)} style={{ flexGrow: 1 }} />)}</View> : null}
        </Panel>)}
      </View>}
    </Screen>
  );
}