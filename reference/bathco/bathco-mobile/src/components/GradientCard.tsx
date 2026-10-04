import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radius } from '../theme';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  glow?: boolean;
}

export default function GradientCard({ children, style, glow }: Props) {
  return (
    <View style={[styles.wrap, glow && styles.glow, style]}>
      <LinearGradient
        colors={gradients.card}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    overflow: 'hidden',
    padding: 16,
  },
  glow: {
    shadowColor: colors.gold,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
