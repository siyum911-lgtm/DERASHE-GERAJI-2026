import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Field, Panel, Screen, colors, ui } from '../../components/UI';
import { apiRequest } from '../../lib/api';
import { money } from '../../lib/format';

export default function ServicesScreen() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    apiRequest(`/services${query ? `?search=${encodeURIComponent(query)}` : ''}`).then((result) => {
      if (active) setServices(result);
    }).catch((reason) => {
      if (active) setError(reason.message);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [query]);

  return (
    <Screen scroll={false}>
      <FlatList
        data={services}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 24, flexGrow: 1 }}
        ListHeaderComponent={<View style={{ gap: 14, marginBottom: 4 }}><View><Text style={{ color: colors.green, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>SERVICE DIRECTORY</Text><Text style={[ui.sectionTitle, { fontSize: 27, marginTop: 6, marginBottom: 0 }]}>Car services</Text><Text style={[ui.muted, { marginTop: 5 }]}>Compare verified providers and estimates.</Text></View><Panel style={{ padding: 12 }}><Field label="Search" value={search} onChangeText={setSearch} placeholder="Service or provider" autoCapitalize="none" /><Pressable accessibilityRole="button" onPress={() => setQuery(search.trim())} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.green, borderRadius: 8 }}><Ionicons name="search" size={17} color={colors.white} /><Text style={{ color: colors.white, fontWeight: '800' }}>Search services</Text></Pressable></Panel>{error ? <Text accessibilityRole="alert" style={{ color: colors.red }}>{error}</Text> : null}</View>}
        ListEmptyComponent={loading ? <ActivityIndicator color={colors.green} style={{ marginTop: 40 }} /> : !error ? <Text style={[ui.muted, { textAlign: 'center', marginTop: 30 }]}>No matching services found.</Text> : null}
        renderItem={({ item }) => <Link href={{ pathname: '/services/[id]', params: { id: item.id } }} asChild><Pressable style={{ flexDirection: 'row', gap: 13, alignItems: 'center', padding: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 11 }}><View style={{ width: 42, height: 42, borderRadius: 10, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="build-outline" size={20} color={colors.green} /></View><View style={{ flex: 1, gap: 4 }}><Text style={{ color: colors.navy, fontSize: 14, fontWeight: '800' }}>{item.name}</Text><Text style={ui.muted}>{item.business_name} · {item.location}</Text><Text style={{ color: colors.green, fontSize: 13, fontWeight: '800' }}>{money(item.price)}</Text></View><Ionicons name="chevron-forward" size={17} color={colors.muted} /></Pressable></Link>}
      />
    </Screen>
  );
}