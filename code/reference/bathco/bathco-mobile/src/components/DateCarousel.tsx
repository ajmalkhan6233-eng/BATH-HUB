import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { colors, radius } from '../theme';
import { DailySummary } from '../api';

interface Props {
  days: DailySummary[];
  selected: string | undefined;
  onSelect: (dateStr: string) => void;
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dayLabel(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  return { weekday: WEEKDAY[d.getDay()], day: d.getDate() };
}

export default function DateCarousel({ days, selected, onSelect }: Props) {
  return (
    <Animated.ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      entering={FadeInRight.duration(400)}
    >
      {days.map((d, i) => {
        const dateStr = d.date_str || d.report_date;
        const { weekday, day } = dayLabel(dateStr);
        const isSelected = dateStr === selected;
        const np = +d.net_profit || 0;
        return (
          <Animated.View key={dateStr} entering={FadeInRight.delay(i * 60).duration(350)}>
            <TouchableOpacity
              style={[styles.pill, isSelected && styles.pillActive]}
              onPress={() => onSelect(dateStr)}
              activeOpacity={0.8}
            >
              <Text style={[styles.weekday, isSelected && styles.weekdayActive]}>{weekday}</Text>
              <Text style={[styles.day, isSelected && styles.dayActive]}>{day}</Text>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: np >= 0 ? colors.mint : colors.coral, opacity: isSelected ? 1 : 0.5 },
                ]}
              />
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 10,
    paddingVertical: 4,
  },
  pill: {
    width: 52,
    paddingVertical: 10,
    borderRadius: radius,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  pillActive: {
    backgroundColor: 'rgba(212,175,55,0.16)',
    borderColor: colors.gold,
  },
  weekday: {
    color: colors.muted,
    fontSize: 11,
    marginBottom: 4,
  },
  weekdayActive: {
    color: colors.gold2,
  },
  day: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  dayActive: {
    color: colors.gold2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
});
