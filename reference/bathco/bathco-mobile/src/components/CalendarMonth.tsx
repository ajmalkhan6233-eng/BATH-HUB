import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colors, DATA_STATUS_COLORS, radius, spacing } from '../theme';
import { DataDayStatus } from '../api';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

interface Props {
  /** First day of the month, e.g. "2026-06" */
  month: string;
  statuses: Record<string, DataDayStatus>;
  selected?: string;
  onSelectDay: (dateStr: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export default function CalendarMonth({ month, statuses, selected, onSelectDay, onPrevMonth, onNextMonth }: Props) {
  const [year, mo] = month.split('-').map(Number);
  const firstOfMonth = new Date(year, mo - 1, 1);
  const daysInMonth = new Date(year, mo, 0).getDate();
  // Monday-first offset
  const startOffset = (firstOfMonth.getDay() + 6) % 7;

  const cells: (string | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${year}-${pad(mo)}-${pad(d)}`);

  const monthLabel = firstOfMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <Animated.View entering={FadeIn.duration(300)}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onPrevMonth} style={styles.navBtn}>
          <Text style={styles.navText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{monthLabel}</Text>
        <TouchableOpacity onPress={onNextMonth} style={styles.navBtn}>
          <Text style={styles.navText}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAYS.map((w, i) => (
          <Text key={i} style={styles.weekday}>{w}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((dateStr, i) => {
          if (!dateStr) return <View key={i} style={styles.cell} />;
          const status = statuses[dateStr];
          const color = status ? DATA_STATUS_COLORS[status] : 'transparent';
          const isSelected = dateStr === selected;
          const day = Number(dateStr.slice(-2));
          return (
            <TouchableOpacity
              key={i}
              style={[
                styles.cell,
                styles.dayCell,
                isSelected && styles.dayCellSelected,
                status ? { borderColor: color } : null,
              ]}
              onPress={() => status && onSelectDay(dateStr)}
              disabled={!status}
              activeOpacity={0.7}
            >
              <Text style={[styles.dayText, !status && styles.dayTextMuted]}>{day}</Text>
              {status ? <View style={[styles.statusDot, { backgroundColor: color }]} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.legend}>
        <LegendItem color={DATA_STATUS_COLORS.complete} label="Complete" />
        <LegendItem color={DATA_STATUS_COLORS.partial} label="Partial" />
        <LegendItem color={DATA_STATUS_COLORS.missing} label="Missing" />
      </View>
    </Animated.View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const CELL_SIZE = 40;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: {
    color: colors.gold2,
    fontSize: 20,
    fontWeight: '700',
    marginTop: -2,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  weekday: {
    width: CELL_SIZE,
    textAlign: 'center',
    color: colors.muted,
    fontSize: 11,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCell: {
    borderRadius: radius / 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dayCellSelected: {
    backgroundColor: 'rgba(212,175,55,0.16)',
  },
  dayText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  dayTextMuted: {
    color: 'rgba(127,147,168,0.35)',
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 3,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    color: colors.muted,
    fontSize: 11,
  },
});
