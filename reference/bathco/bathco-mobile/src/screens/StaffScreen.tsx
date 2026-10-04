import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, gradients, spacing } from '../theme';
import { api, PayPeriodSummary, StaffRow } from '../api';
import GradientCard from '../components/GradientCard';
import AnimatedCounter from '../components/AnimatedCounter';
import Leaderboard from '../components/Leaderboard';

function fmtDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function StaffScreen() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [period, setPeriod] = useState<PayPeriodSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [s, p] = await Promise.all([api.staff(), api.payPeriodSummary()]);
    setStaff(s);
    setPeriod(p);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const fullDays = period ? +period.full_days : 0;
  const totalDays = period ? +period.total_days : 0;
  const periodNP = period ? +period.net_profit : 0;

  return (
    <View style={styles.container}>
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} colors={[colors.gold]} />
          }
        >
          <Animated.View entering={FadeInDown.duration(450)}>
            <Text style={styles.heading}>Staff</Text>
            <Text style={styles.subheading}>Ranked by total commission earned</Text>
          </Animated.View>

          {period && (
            <Animated.View entering={FadeInDown.delay(100).duration(450)}>
              <GradientCard glow>
                <Text style={styles.periodLabel}>
                  Pay period {fmtDate(period.from)} – {fmtDate(period.to)}
                </Text>
                {fullDays > 0 ? (
                  <View style={styles.periodNpRow}>
                    <Text style={styles.periodNpLabel}>Net Profit so far</Text>
                    <AnimatedCounter
                      value={periodNP}
                      prefix="Rs "
                      style={[styles.periodNpValue, { color: periodNP >= 0 ? colors.mint : colors.coral }]}
                    />
                  </View>
                ) : (
                  <Text style={styles.pending}>
                    Net Profit PENDING — no full P&L days yet in this pay period ({totalDays} day{totalDays === 1 ? '' : 's'} recorded so far)
                  </Text>
                )}
                <Text style={styles.periodNote}>
                  {fullDays > 0
                    ? `${fullDays} of ${totalDays} days have full P&L data — commission below updates automatically as more days come in.`
                    : 'Commission per staff member becomes available once at least one full P&L day is recorded in this pay period.'}
                </Text>
              </GradientCard>
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.delay(180).duration(450)} style={styles.section}>
            <Text style={styles.sectionTitle}>Leaderboard — total commission</Text>
            {staff.length > 0 ? (
              <Leaderboard staff={staff} />
            ) : (
              <GradientCard><Text style={styles.pending}>No active staff records yet.</Text></GradientCard>
            )}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
    gap: spacing.lg,
  },
  heading: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  subheading: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
    marginBottom: spacing.sm,
  },
  periodLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  periodNpRow: {
    marginBottom: spacing.sm,
  },
  periodNpLabel: {
    color: colors.muted,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  periodNpValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  periodNote: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
  },
  pending: {
    color: colors.gold2,
    fontSize: 12,
    lineHeight: 17,
  },
  section: {},
  sectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
});
