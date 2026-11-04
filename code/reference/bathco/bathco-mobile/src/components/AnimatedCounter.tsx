import React, { useEffect } from 'react';
import { StyleSheet, StyleProp, TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  withTiming,
  Easing,
  useAnimatedProps,
} from 'react-native-reanimated';
import { TextInput } from 'react-native';

Animated.addWhitelistedNativeProps({ text: true });
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

interface Props {
  value: number;
  prefix?: string;
  decimals?: number;
  style?: StyleProp<TextStyle>;
  duration?: number;
}

function formatNumber(n: number, decimals: number) {
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export default function AnimatedCounter({ value, prefix = '', decimals = 0, style, duration = 1100 }: Props) {
  const animated = useSharedValue(0);

  useEffect(() => {
    animated.value = 0;
    animated.value = withTiming(value, { duration, easing: Easing.out(Easing.cubic) });
  }, [value]);

  const animatedProps = useAnimatedProps(() => {
    return { text: `${prefix}${formatNumber(animated.value, decimals)}` } as any;
  });

  return (
    <AnimatedTextInput
      style={[styles.base, style]}
      editable={false}
      defaultValue={`${prefix}${formatNumber(value, decimals)}`}
      animatedProps={animatedProps}
      underlineColorAndroid="transparent"
    />
  );
}

const styles = StyleSheet.create({
  base: {
    padding: 0,
    includeFontPadding: false,
  },
});
