import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, gradients, spacing, DATA_STATUS_COLORS } from '../theme';
import { api, DailySummary, DataIndex } from '../api';
import GradientCard from '../components/GradientCard';
import CalendarMonth from '../components/CalendarMonth';
import TierBadge from '../components/TierBadge';
import AnimatedCounter from '../components/AnimatedCounter';

const STATUS_LABEL: Record<string, string> = {
  complete: 'All source files matched for this day',
  partial: 'Some source files missing for this day',
  missing: 'No source files found for this day',
  mismatch: 'Source files found but dates don’t align',
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export default function ReportsScreen() {
  const [dataIndex, setDataIndex] = useState<DataIndex | null>(null);
  const [month, setMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  });
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const [dayReport, setDayReport] = useState<DailySummary | null | undefined>(undefined);

  useEffect(() => {
    api.dataIndex().then(idx => {
      setDataIndex(idx);
      // Default to the most recent month that has any indexed data
      const last = idx.range.to;
      setMonth(last.slice(0, 7));
    }).catch(() => {});
  }, []);

  const statuses = useMemo(() => {
    if (!dataIndex) return {};
    const out: Record<string, any> = {};
    for (const [date, day] of Object.entries(dataIndex.days)) {
      out[date] = day.status;
    }
    return out;
  }, [dataIndex]);

  const onSelectDay = useCallback(async (dateStr: string) => {
    setSelected(dateStr);
    setDayReport(undefined);
    try {
      const rows = await api.dailySummary(dateStr);
      setDayReport(rows[0] || null);
    } catch {
      setDayReport(null);
    }
  }, []);

  const shiftMonth = (delta: number) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
  };

  const selectedStatus = selected ? dataIndex?.days[selected]?.status : undefined;

  return (
    <View style={styles.container}>
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.duration(450)}>
            <Text style={styles.heading}>Reports</Text>
            <Text style={styles.subheading}>Source-data coverage by day — tap a day for its full report</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100).duration(450)}>
            <GradientCard>
              <CalendarMonth
                month={month}
                statuses={statuses}
                selected={selected}
                onSelectDay={onSelectDay}
                onPrevMonth={() => shiftMonth(-1)}
                onNextMonth={() => shiftMonth(1)}
              />
            </GradientCard>
          </Animated.View>

          {selected && (
            <Animated.View entering={FadeInDown.delay(80).duration(400)} style={styles.section}>
              <GradientCard>
                <View style={styles.detailHeader}>
                  <Text style={styles.detailDate}>
                    {new Date(`${selected}T00:00:00`).toLocaleDateString('en-GB', {
                      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </Text>
                  {selectedStatus ? (
                    <View style={[styles.statusPill, { borderColor: DATA_STATUS_COLORS[selectedStatus] }]}>
                      <Text style={[styles.statusPillText, { color: DATA_STATUS_COLORS[selectedStatus] }]}>
                        {selectedStatus.toUpperCase()}
                      </Text>
                    </View>
                  ) : null}
                </View>
                {selectedStatus ? (
                  <Text style={styles.statusDesc}>{STATUS_LABEL[selectedStatus]}</Text>
                ) : null}

                {dayReport === undefined ? (
                  <Text style={styles.muted}>Loading…</Text>
                ) : dayReport === null ? (
                  <Text style={styles.muted}>No daily summary recorded for this date yet.</Text>
                ) : (
                  <View style={styles.figures}>
                    <TierBadge tier={dayReport.data_tier} />
                    <View style={styles.figureRow}>
                      <Figure label="Sales" value={+dayReport.total_sale || 0} color={colors.text} />
                      <Figure label="Gross Profit" value={+dayReport.gross_profit || 0} color={colors.gold2} />
                    </View>
                    <View style={styles.figureRow}>
                      <Figure
                        label="Net Profit"
                        value={+dayReport.net_profit || 0}
                        color={(+dayReport.net_profit || 0) >= 0 ? colors.mint : colors.coral}
                      />
                      <Figure label="Expenses" value={+dayReport.total_expenses || 0} color={colors.coral} />
                    </View>
                  </View>
                )}
              </GradientCard>
            </Animated.View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Figure({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.figure}>
      <Text style={styles.figureLabel}>{label}</Text>
      <AnimatedCounter value={value} prefix="Rs " style={[styles.figureValue, { color }]} />
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
    marginBottom: spacing.md,
  },
  section: {},
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  detailDate: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    marginRight: spacing.sm,
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusDesc: {
    color: colors.muted,
    fontSize: 11,
    marginBottom: spacing.md,
  },
  muted: {
    color: colors.muted,
    fontSize: 12,
  },
  figures: {
    gap: spacing.md,
  },
  figureRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  figure: {
    flex: 1,
  },
  figureLabel: {
    color: colors.muted,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  figureValue: {
    fontSize: 16,
    fontWeight: '700',
  },
});
