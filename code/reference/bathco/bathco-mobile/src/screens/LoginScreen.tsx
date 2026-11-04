import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { colors, gradients, radius, spacing } from '../theme';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const { login, loading, error } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  return (
    <View style={styles.container}>
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <Animated.View entering={FadeInUp.duration(600).springify()} style={styles.brand}>
          <Text style={styles.brandTitle}>1st Choice</Text>
          <Text style={styles.brandSubtitle}>BathCo (Pvt) Ltd</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(600).springify()} style={styles.card}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="username"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />

          <Text style={[styles.label, { marginTop: spacing.lg }]}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={() => {
              console.log('[Login] Sign In pressed', { username, hasPassword: !!password });
              login(username, password).catch(() => {});
            }}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>{loading ? 'Signing in…' : 'Sign In'}</Text>
          </TouchableOpacity>

          <Text style={styles.hint}>Connects to 1st Choice BathCo (Pvt) Ltd server on this network</Text>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl },
  brand: { alignItems: 'center', marginBottom: spacing.xl * 2 },
  brandTitle: {
    color: colors.gold2,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 2,
  },
  brandSubtitle: {
    color: colors.muted,
    fontSize: 13,
    letterSpacing: 2,
    marginTop: 4,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radius,
    padding: spacing.xl,
  },
  label: {
    color: colors.muted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  error: {
    color: colors.coral,
    fontSize: 12,
    marginTop: spacing.md,
  },
  button: {
    marginTop: spacing.xl,
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.navy,
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  hint: {
    color: colors.muted,
    fontSize: 10,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
