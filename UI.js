import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export const colors = {
  ink: '#173247', navy: '#102a43', green: '#16835f', mint: '#e8f5ef',
  paper: '#f4f7f6', white: '#ffffff', muted: '#70818e', line: '#dfe7e6',
  red: '#a6423b', paleRed: '#fff0ee', amber: '#916512', paleAmber: '#fff5d8',
};

export function Screen({ children, scroll = true, contentStyle }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.page, contentStyle]}>{children}</ScrollView> : children}
    </SafeAreaView>
  );
}

export function Heading({ eyebrow, title, subtitle }) {
  return <View style={styles.heading}>{eyebrow ? <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text> : null}<Text style={styles.title}>{title}</Text>{subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}</View>;
}

export function Panel({ children, style }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function Button({ title, onPress, secondary = false, disabled = false, icon, style }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.button, secondary && styles.buttonSecondary, disabled && styles.buttonDisabled, pressed && !disabled && styles.buttonPressed, style]}>
      {icon || null}<Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, autoCapitalize, multiline, editable = true }) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8a9aa3"
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize || 'sentences'}
        autoCorrect={!secureTextEntry}
        multiline={multiline}
        editable={editable}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[styles.input, multiline && styles.textarea, !editable && styles.inputDisabled]}
      />
    </View>
  );
}

export function Notice({ message, success = false }) {
  if (!message) return null;
  return <Text accessibilityRole="alert" style={[styles.notice, success ? styles.noticeSuccess : styles.noticeError]}>{message}</Text>;
}

export function Loading({ label = 'Loading…' }) {
  return <View style={styles.loading}><ActivityIndicator color={colors.green} /><Text style={styles.subtitle}>{label}</Text></View>;
}

export function BackButton() {
  return <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={19} color={colors.ink} /><Text style={styles.backText}>Back</Text></Pressable>;
}

export const ui = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  sectionTitle: { color: colors.navy, fontSize: 18, fontWeight: '800', marginBottom: 12 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  badge: { overflow: 'hidden', color: colors.green, backgroundColor: colors.mint, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  page: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 30, gap: 16 },
  heading: { gap: 6, marginBottom: 2 },
  eyebrow: { color: colors.green, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title: { color: colors.navy, fontSize: 27, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  panel: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, borderRadius: 12, padding: 16, gap: 12 },
  button: { minHeight: 48, borderRadius: 9, backgroundColor: colors.green, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buttonSecondary: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1 },
  buttonDisabled: { opacity: 0.55 },
  buttonPressed: { opacity: 0.83 },
  buttonText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  buttonTextSecondary: { color: colors.ink },
  field: { gap: 7 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  input: { minHeight: 48, backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, borderRadius: 8, paddingHorizontal: 13, color: colors.ink, fontSize: 16 },
  textarea: { minHeight: 100, paddingTop: 12 },
  inputDisabled: { color: colors.muted, backgroundColor: colors.paper },
  notice: { borderRadius: 8, padding: 12, fontSize: 13, lineHeight: 19, overflow: 'hidden' },
  noticeError: { color: colors.red, backgroundColor: colors.paleRed },
  noticeSuccess: { color: colors.green, backgroundColor: colors.mint },
  loading: { minHeight: 140, alignItems: 'center', justifyContent: 'center', gap: 12 },
  back: { alignSelf: 'flex-start', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, paddingRight: 12 },
  backText: { color: colors.ink, fontSize: 14, fontWeight: '700' },
});