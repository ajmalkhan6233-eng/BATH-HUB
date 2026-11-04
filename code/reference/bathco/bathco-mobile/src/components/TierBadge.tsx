import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TIER_COLORS, colors } from '../theme';

const TIER_LABELS: Record<string, string> = {
  FULL: 'Full P&L',
  CASHFLOW: 'Cashflow',
  FOUNDATION: 'Revenue only',
};

export default function TierBadge({ tier }: { tier: string }) {
  const color = TIER_COLORS[tier] || colors.muted;
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>{TIER_LABELS[tier] || tier}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
