import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import GradientCard from './GradientCard';
import AnimatedCounter from './AnimatedCounter';
import DonutChart from './DonutChart';
import TierBadge from './TierBadge';
import { colors, spacing } from '../theme';

interface Props {
  sale: number;
  gp: number;
  np: number;
  tier?: string;
  dateLabel: string;
}

export default function PulseCard({ sale, gp, np, tier, dateLabel }: Props) {
  const ratio = sale > 0 ? np / sale : 0;

  return (
    <Animated.View entering={FadeInDown.duration(500).springify()}>
      <GradientCard glow style={styles.card}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Today&apos;s Pulse</Text>
            <Text style={styles.subtitle}>{dateLabel}</Text>
          </View>
          {tier ? <TierBadge tier={tier} /> : null}
        </View>

        <View style={styles.body}>
          <View style={styles.figures}>
            <Animated.View entering={FadeInDown.delay(80).duration(450)}>
              <Text style={styles.figureLabel}>Sales</Text>
              <AnimatedCounter value={sale} prefix="Rs " style={[styles.figureValue, { color: colors.text }]} />
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(160).duration(450)} style={styles.figureGap}>
              <Text style={styles.figureLabel}>Gross Profit</Text>
              <AnimatedCounter value={gp} prefix="Rs " style={[styles.figureValue, { color: colors.gold2 }]} />
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(240).duration(450)} style={styles.figureGap}>
              <Text style={styles.figureLabel}>Net Profit</Text>
              <AnimatedCounter
                value={np}
                prefix="Rs "
                style={[styles.figureValue, { color: np >= 0 ? colors.mint : colors.coral }]}
              />
            </Animated.View>
          </View>

          <Animated.View entering={FadeInDown.delay(280).duration(500)}>
            <DonutChart ratio={ratio} label="NP margin" />
          </Animated.View>
        </View>
      </GradientCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  figures: {
    flex: 1,
  },
  figureGap: {
    marginTop: spacing.md,
  },
  figureLabel: {
    color: colors.muted,
    fontSize: 11,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  figureValue: {
    fontSize: 22,
    fontWeight: '700',
  },
});
