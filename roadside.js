import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { router } from 'expo-router';
import { Button, Field, Heading, Notice, Panel, Screen, colors, ui } from '../../components/UI';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';
import { dateTime } from '../../lib/format';

const problems = ['Vehicle breakdown', 'Flat tire', 'Dead battery', 'Engine problem', 'Accident assistance', 'Fuel problem', 'Towing'];

export default function RoadsideScreen() {
  const { user, token, ready } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState({ vehicleId: '', location: '', phone: user?.phone || '', problemType: problems[0], description: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    if (!ready) return;
    if (!token) { setLoading(false); return; }
    let active = true;
    const requestsPromise = apiRequest('/roadside', { token });
    const vehiclesPromise = user?.role === 'customer' ? apiRequest('/vehicles', { token }) : Promise.resolve([]);
    Promise.all([requestsPromise, vehiclesPromise]).then(([items, cars]) => {
      if (active) { setRequests(items); setVehicles(cars); }
    }).catch((reason) => { if (active) setError(reason.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [ready, token, user]);

  const submit = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const created = await apiRequest('/roadside', { method: 'POST', token, body: { ...form, vehicleId: Number(form.vehicleId) } });
      setRequests((items) => [created, ...items]);
      setMessage('Your roadside assistance request was sent.');
      setForm((current) => ({ ...current, description: '' }));
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  };

  const updateStatus = async (request, status) => {
    try {
      const result = await apiRequest(`/roadside/${request.id}/status`, { method: 'PATCH', token, body: { status } });
      setRequests((items) => items.map((item) => item.id === request.id ? { ...item, ...result } : item));
    } catch (reason) { setError(reason.message); }
  };

  if (!ready || loading) return <Screen><ActivityIndicator color={colors.green} style={{ marginTop: 60 }} /></Screen>;
  if (!user) return <Screen><Heading title="Roadside assistance" subtitle="Sign in to request and follow help on the road." /><Button title="Log in" onPress={() => router.push('/login')} /></Screen>;

  return (
    <Screen>
      <Heading eyebrow="HELP ON THE ROAD" title="Roadside assistance" subtitle="Send your location and issue to trusted automotive professionals." />
      <Notice message={error} /><Notice message={message} success />
      {user.role === 'customer' ? vehicles.length === 0 ? <Panel><Text style={ui.muted}>Add a vehicle before requesting roadside assistance.</Text><Button title="Add a vehicle" onPress={() => router.push('/vehicles')} /></Panel> : <Panel>
        <Text style={ui.sectionTitle}>Request assistance</Text>
        <Text style={ui.label}>Vehicle</Text><View style={{ borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: colors.line }}><Picker selectedValue={form.vehicleId} onValueChange={(value) => set('vehicleId', value)}><Picker.Item label="Choose your vehicle" value="" />{vehicles.map((vehicle) => <Picker.Item key={vehicle.id} label={`${vehicle.year} ${vehicle.make} ${vehicle.model} · ${vehicle.plate_number}`} value={String(vehicle.id)} />)}</Picker></View>
        <Field label="Your location" value={form.location} onChangeText={(value) => set('location', value)} placeholder="Street, neighborhood, or landmark" />
        <Field label="Contact phone" value={form.phone} onChangeText={(value) => set('phone', value)} keyboardType="phone-pad" />
        <Text style={ui.label}>Type of problem</Text><View style={{ borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: colors.line }}><Picker selectedValue={form.problemType} onValueChange={(value) => set('problemType', value)}>{problems.map((problem) => <Picker.Item key={problem} label={problem} value={problem} />)}</Picker></View>
        <Field label="Describe the issue" value={form.description} onChangeText={(value) => set('description', value)} placeholder="Tell us what happened" multiline />
        <Button title={busy ? 'Sending…' : 'Request roadside help'} disabled={busy || !form.vehicleId || form.location.trim().length < 3 || form.phone.trim().length < 7 || form.description.trim().length < 5} onPress={submit} />
      </Panel> : <Text style={ui.muted}>New unassigned requests for your area will appear here.</Text>}
      <Text style={ui.sectionTitle}>Recent requests</Text>
      {requests.length === 0 ? <Panel><Text style={ui.muted}>No roadside requests yet.</Text></Panel> : requests.map((request) => <Panel key={request.id}>
        <View style={ui.row}><Text style={{ color: colors.navy, fontWeight: '800' }}>Request #{request.id} · {request.problem_type}</Text><Text style={ui.badge}>{request.status}</Text></View>
        <Text style={ui.muted}>{request.make} {request.model} · {request.location}</Text>
        <Text style={ui.muted}>{dateTime(request.created_at)}</Text>
        {user.role === 'provider' && request.status === 'Pending' ? <Button title="Accept request" onPress={() => updateStatus(request, 'Accepted')} /> : null}
        {user.role === 'provider' && request.status === 'Accepted' ? <Button title="Start assistance" onPress={() => updateStatus(request, 'In Progress')} /> : null}
        {user.role === 'provider' && request.status === 'In Progress' ? <Button title="Mark completed" onPress={() => updateStatus(request, 'Completed')} /> : null}
        {user.role === 'customer' && request.status === 'Pending' ? <Button title="Cancel request" secondary onPress={() => updateStatus(request, 'Cancelled')} /> : null}
      </Panel>)}
    </Screen>
  );
}