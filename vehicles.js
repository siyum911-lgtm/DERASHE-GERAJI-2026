import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { router } from 'expo-router';
import { BackButton, Button, Field, Heading, Loading, Notice, Panel, Screen, colors, ui } from '../components/UI';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';

const emptyVehicle = () => ({ make: '', model: '', year: String(new Date().getFullYear()), plateNumber: '', vin: '', mileage: '0', fuelType: 'Petrol' });

export default function VehiclesScreen() {
  const { user, token, ready } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [form, setForm] = useState(emptyVehicle);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    if (!ready) return;
    if (!user) { setLoading(false); return; }
    apiRequest('/vehicles', { token }).then(setVehicles).catch((reason) => setError(reason.message)).finally(() => setLoading(false));
  }, [ready, token, user]);

  const save = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const vehicle = await apiRequest('/vehicles', { method: 'POST', token, body: { ...form, year: Number(form.year), mileage: Number(form.mileage) } });
      setVehicles((current) => [vehicle, ...current]);
      setForm(emptyVehicle());
      setMessage('Vehicle added to your garage.');
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = (vehicle) => Alert.alert('Remove vehicle?', `${vehicle.year} ${vehicle.make} ${vehicle.model} will be removed from your garage.`, [
    { text: 'Keep vehicle', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: async () => {
      try {
        await apiRequest(`/vehicles/${vehicle.id}`, { method: 'DELETE', token });
        setVehicles((current) => current.filter((item) => item.id !== vehicle.id));
      } catch (reason) {
        setError(reason.message);
      }
    } },
  ]);

  if (!ready || loading) return <Screen><Loading /></Screen>;
  if (!user) return <Screen><BackButton /><Heading title="Sign in required" subtitle="Sign in to manage your garage." /><Button title="Log in" onPress={() => router.push('/login')} /></Screen>;
  if (user.role !== 'customer') return <Screen><BackButton /><Heading title="Customer account required" subtitle="Vehicle management is available to customer accounts." /></Screen>;

  return (
    <Screen>
      <BackButton />
      <Heading eyebrow="YOUR GARAGE" title="My vehicles" subtitle="Keep vehicle details ready for bookings and roadside assistance." />
      {vehicles.map((vehicle) => <Panel key={vehicle.id}>
        <View style={ui.row}><View style={{ flex: 1 }}><Text style={{ color: colors.navy, fontSize: 15, fontWeight: '800' }}>{vehicle.year} {vehicle.make} {vehicle.model}</Text><Text style={ui.muted}>{vehicle.plate_number} · {Number(vehicle.mileage).toLocaleString()} km</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`Remove ${vehicle.make} ${vehicle.model}`} onPress={() => remove(vehicle)} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.red, fontWeight: '800' }}>Remove</Text></Pressable></View>
      </Panel>)}
      <Panel>
        <Text style={ui.sectionTitle}>Add a vehicle</Text>
        <Field label="Make" value={form.make} onChangeText={(value) => set('make', value)} placeholder="Toyota" />
        <Field label="Model" value={form.model} onChangeText={(value) => set('model', value)} placeholder="Corolla" />
        <View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><Field label="Year" value={form.year} onChangeText={(value) => set('year', value)} keyboardType="number-pad" /></View><View style={{ flex: 1 }}><Field label="Plate number" value={form.plateNumber} onChangeText={(value) => set('plateNumber', value)} autoCapitalize="characters" /></View></View>
        <Field label="VIN / chassis number (optional)" value={form.vin} onChangeText={(value) => set('vin', value)} autoCapitalize="characters" />
        <Field label="Mileage (km)" value={form.mileage} onChangeText={(value) => set('mileage', value)} keyboardType="number-pad" />
        <Text style={ui.label}>Fuel type</Text>
        <View style={{ borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: colors.line }}><Picker selectedValue={form.fuelType} onValueChange={(value) => set('fuelType', value)}>{['Petrol', 'Diesel', 'Hybrid', 'Electric', 'LPG', 'Other'].map((fuel) => <Picker.Item key={fuel} label={fuel} value={fuel} />)}</Picker></View>
        <Notice message={message} success /><Notice message={error} />
        <Button title={busy ? 'Saving…' : 'Add vehicle'} disabled={busy || !form.make.trim() || !form.model.trim() || !form.plateNumber.trim()} onPress={save} />
      </Panel>
    </Screen>
  );
}