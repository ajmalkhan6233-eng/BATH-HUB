import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, gradients, spacing } from '../theme';
import { api, ApiError, DailySummary } from '../api';
import PulseCard from '../components/PulseCard';
import DateCarousel from '../components/DateCarousel';
import GradientCard from '../components/GradientCard';
import AnimatedCounter from '../components/AnimatedCounter';

export default function HomeScreen() {
  const [recent, setRecent] = useState<DailySummary[]>([]);
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const [mtd, setMtd] = useState<{ sale: number; gp: number; np: number; days: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [days, stats] = await Promise.all([api.recentDays(7), api.homeStats()]);
    const sorted = [...days].sort((a, b) => (a.date_str || a.report_date).localeCompare(b.date_str || b.report_date));
    setRecent(sorted);
    setSelected(prev => prev ?? (sorted.length ? sorted[sorted.length - 1].date_str || sorted[sorted.length - 1].report_date : undefined));
    setMtd({
      sale: +stats.mtd.sale || 0,
      gp: +stats.mtd.gp || 0,
      np: +stats.mtd.np || 0,
      days: +stats.mtd.days || 0,
    });
  }, []);

  useEffect(() => {
    setError(null);
    load()
      .catch(e => {
        console.log('[Home] load failed:', e);
        setError(e instanceof ApiError ? `${e.status}: ${e.message}` : 'Could not reach the server');
      })
      .finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? `${e.status}: ${e.message}` : 'Could not reach the server');
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const activeDay = recent.find(d => (d.date_str || d.report_date) === selected);

  const dateLabel = activeDay
    ? new Date(`${activeDay.date_str || activeDay.report_date}T00:00:00`).toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    : '—';

  return (
    <View style={styles.container}>
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.gold}
              colors={[colors.gold]}
              progressBackgroundColor={colors.teal}
            />
          }
        >
          <Animated.View entering={FadeInDown.duration(450)}>
            <Text style={styles.greeting}>1st Choice BathCo (Pvt) Ltd</Text>
          </Animated.View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {loading ? <Text style={styles.loading}>Loading…</Text> : null}

          {!loading && activeDay ? (
            <PulseCard
              sale={+activeDay.total_sale || 0}
              gp={+activeDay.gross_profit || 0}
              np={+activeDay.net_profit || 0}
              tier={activeDay.data_tier}
              dateLabel={dateLabel}
            />
          ) : null}

          {recent.length > 0 && (
            <Animated.View entering={FadeInDown.delay(120).duration(450)} style={styles.section}>
              <Text style={styles.sectionTitle}>Last 7 days</Text>
              <DateCarousel
                days={recent}
                selected={selected}
                onSelect={setSelected}
              />
            </Animated.View>
          )}

          {mtd && (
            <Animated.View entering={FadeInDown.delay(220).duration(450)} style={styles.section}>
              <Text style={styles.sectionTitle}>Month to date ({mtd.days} days)</Text>
              <GradientCard style={styles.mtdRow}>
                <MtdFigure label="Sales" value={mtd.sale} color={colors.text} />
                <MtdFigure label="Gross Profit" value={mtd.gp} color={colors.gold2} />
                <MtdFigure label="Net Profit" value={mtd.np} color={mtd.np >= 0 ? colors.mint : colors.coral} />
              </GradientCard>
            </Animated.View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function MtdFigure({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.mtdFigure}>
      <Text style={styles.mtdLabel}>{label}</Text>
      <AnimatedCounter value={value} prefix="Rs " style={[styles.mtdValue, { color }]} />
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
  greeting: {
    color: colors.muted,
    fontSize: 12,
    letterSpacing: 3,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  error: {
    color: colors.coral,
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  loading: {
    color: colors.muted,
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  section: {
    marginTop: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  mtdRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  mtdFigure: {
    flex: 1,
  },
  mtdLabel: {
    color: colors.muted,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  mtdValue: {
    fontSize: 14,
    fontWeight: '700',
  },
});
