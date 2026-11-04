import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GradientCard from './GradientCard';
import AnimatedCounter from './AnimatedCounter';
import { colors, spacing } from '../theme';
import { StaffRow } from '../api';

const STORAGE_KEY = 'bathco_staff_rank_snapshot_v1';

interface RankedStaff extends StaffRow {
  rank: number;
  delta: number | null; // previous rank - current rank (positive = moved up); null = no history
}

function rankColor(rank: number) {
  if (rank === 0) return colors.gold2;
  if (rank === 1) return colors.mint;
  if (rank === 2) return '#5dade2';
  return colors.muted;
}

export default function Leaderboard({ staff }: { staff: StaffRow[] }) {
  const [ranked, setRanked] = useState<RankedStaff[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sorted = [...staff].sort((a, b) => (+b.total_commission || 0) - (+a.total_commission || 0));

      let prevRanks: Record<string, number> = {};
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) prevRanks = JSON.parse(raw);
      } catch {
        // first run / storage unavailable — no history to compare against
      }

      const result: RankedStaff[] = sorted.map((s, i) => ({
        ...s,
        rank: i,
        delta: prevRanks[s.id] !== undefined ? prevRanks[s.id] - i : null,
      }));

      const nextRanks: Record<string, number> = {};
      sorted.forEach((s, i) => { nextRanks[s.id] = i; });
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextRanks)).catch(() => {});

      if (!cancelled) setRanked(result);
    })();
    return () => { cancelled = true; };
  }, [staff]);

  if (!ranked) return null;

  return (
    <View style={styles.list}>
      {ranked.map((s, i) => (
        <Animated.View key={s.id} entering={FadeInDown.delay(i * 70).duration(420).springify()}>
          <GradientCard style={styles.row}>
            <View style={[styles.rankBadge, { borderColor: rankColor(s.rank) }]}>
              <Text style={[styles.rankText, { color: rankColor(s.rank) }]}>{s.rank + 1}</Text>
            </View>

            <View style={styles.info}>
              <Text style={styles.name}>{s.name}</Text>
              <Text style={styles.role}>{s.role}</Text>
            </View>

            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Total commission</Text>
              <AnimatedCounter
                value={+s.total_commission || 0}
                prefix="Rs "
                style={styles.metricValue}
              />
            </View>

            <RankDelta delta={s.delta} />
          </GradientCard>
        </Animated.View>
      ))}
    </View>
  );
}

function RankDelta({ delta }: { delta: number | null }) {
  if (delta === null) {
    return (
      <View style={styles.deltaWrap}>
        <Text style={[styles.deltaText, { color: colors.muted }]}>NEW</Text>
      </View>
    );
  }
  if (delta === 0) {
    return (
      <View style={styles.deltaWrap}>
        <Text style={[styles.deltaText, { color: colors.muted }]}>—</Text>
      </View>
    );
  }
  const up = delta > 0;
  return (
    <View style={styles.deltaWrap}>
      <Text style={[styles.deltaText, { color: up ? colors.mint : colors.coral }]}>
        {up ? '▲' : '▼'} {Math.abs(delta)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: spacing.md,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontWeight: '700',
    fontSize: 14,
  },
  info: {
    flex: 1,
  },
  name: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  role: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  metric: {
    alignItems: 'flex-end',
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  metricValue: {
    color: colors.gold2,
    fontSize: 15,
    fontWeight: '700',
  },
  deltaWrap: {
    minWidth: 36,
    alignItems: 'flex-end',
    marginLeft: spacing.sm,
  },
  deltaText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
