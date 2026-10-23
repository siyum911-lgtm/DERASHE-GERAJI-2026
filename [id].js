import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BackButton, Button, Field, Heading, Notice, Panel, Screen, colors, ui } from '../../components/UI';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';
import { money } from '../../lib/format';

export default function ServiceDetailsScreen() {
  const { id } = useLocalSearchParams();
  const { user, token } = useAuth();
  const [service, setService] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [vehicleId, setVehicleId] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date(Date.now() + 86400000));
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    apiRequest('/services').then((items) => setService(items.find((item) => String(item.id) === String(id)) || null)).catch((reason) => setError(reason.message)).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (token && user?.role === 'customer') apiRequest('/vehicles', { token }).then(setVehicles).catch((reason) => setError(reason.message));
  }, [token, user]);

  const book = async () => {
    if (!user) return router.push('/login');
    if (user.role !== 'customer') return setError('Only customer accounts can place repair bookings.');
    if (!vehicleId) return setError('Add and choose a vehicle before booking.');
    setBusy(true);
    setError('');
    try {
      await apiRequest('/bookings', { method: 'POST', token, body: { vehicleId: Number(vehicleId), serviceId: Number(id), problemDescription: description.trim(), scheduledAt: date.toISOString(), callbackRequested: false } });
      setMessage('Your repair request was sent to the provider.');
      setDescription('');
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Screen><ActivityIndicator color={colors.green} style={{ marginTop: 80 }} /></Screen>;
  if (!service) return <Screen><BackButton /><Heading title="Service unavailable" subtitle={error || 'This service may no longer be listed.'} /><Button title="Browse services" secondary onPress={() => router.back()} /></Screen>;

  return (
    <Screen>
      <BackButton />
      <Heading eyebrow={service.category} title={service.name} subtitle={service.business_name} />
      <Panel>
        <View style={ui.row}><Text style={[ui.muted, { flex: 1 }]}>{service.description}</Text><Text style={ui.badge}>{Number(service.rating || 0).toFixed(1)} ★</Text></View>
        <View style={ui.row}><Text style={ui.muted}>{service.location} · {service.experience_years} years experience</Text><Text style={{ color: colors.navy, fontSize: 16, fontWeight: '900' }}>{money(service.price)}</Text></View>
        {service.phone ? <Button title={`Call ${service.phone}`} secondary icon={<Ionicons name="call-outline" size={17} color={colors.green} />} onPress={() => Linking.openURL(`tel:${service.phone}`)} /> : null}
      </Panel>
      <Panel>
        <Text style={ui.sectionTitle}>Request this service</Text>
        {!user ? <><Text style={ui.muted}>Sign in with a customer account to request an appointment.</Text><Button title="Log in to book" onPress={() => router.push('/login')} /></> : user.role !== 'customer' ? <Text style={ui.muted}>Only customer accounts can place repair bookings.</Text> : vehicles.length === 0 ? <><Text style={ui.muted}>Add a vehicle before making a booking.</Text><Button title="Add a vehicle" secondary onPress={() => router.push('/vehicles')} /></> : <>
          <Text style={ui.label}>Vehicle</Text>
          <View style={{ borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: colors.line }}><Picker selectedValue={vehicleId} onValueChange={setVehicleId}><Picker.Item label="Choose your vehicle" value="" />{vehicles.map((vehicle) => <Picker.Item key={vehicle.id} label={`${vehicle.year} ${vehicle.make} ${vehicle.model} · ${vehicle.plate_number}`} value={String(vehicle.id)} />)}</Picker></View>
          <Field label="Describe the problem" value={description} onChangeText={setDescription} placeholder="What is happening with your vehicle?" multiline />
          <Text style={ui.label}>Preferred appointment</Text>
          <View style={{ flexDirection: 'row', gap: 9 }}><Pressable onPress={() => setShowDate(true)} style={{ flex: 1, minHeight: 46, justifyContent: 'center', paddingHorizontal: 11, borderColor: colors.line, borderWidth: 1, borderRadius: 8 }}><Text style={{ color: colors.ink }}>{date.toLocaleDateString()}</Text></Pressable><Pressable onPress={() => setShowTime(true)} style={{ flex: 1, minHeight: 46, justifyContent: 'center', paddingHorizontal: 11, borderColor: colors.line, borderWidth: 1, borderRadius: 8 }}><Text style={{ color: colors.ink }}>{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text></Pressable></View>
          {showDate ? <DateTimePicker value={date} mode="date" minimumDate={new Date()} onChange={(_event, next) => { setShowDate(false); if (next) setDate((current) => new Date(next.getFullYear(), next.getMonth(), next.getDate(), current.getHours(), current.getMinutes())); }} /> : null}
          {showTime ? <DateTimePicker value={date} mode="time" onChange={(_event, next) => { setShowTime(false); if (next) setDate((current) => new Date(current.getFullYear(), current.getMonth(), current.getDate(), next.getHours(), next.getMinutes())); }} /> : null}
          <Notice message={message} success />
          <Notice message={error} />
          <Button title={busy ? 'Sending…' : 'Submit booking request'} disabled={busy || description.trim().length < 5} onPress={book} />
        </>}
      </Panel>
    </Screen>
  );
}