import { useEffect, useState } from 'react';
import { Animated, Image, StyleSheet, Text, View, type ViewStyle } from 'react-native';

export type GrayCatActorState = 'idle' | 'working' | 'help' | 'done' | 'pushed' | 'hit';

type GrayCatActorProps = {
  size?: number;
  state?: GrayCatActorState;
  quote?: string;
  showQuote?: boolean;
  showDebug?: boolean;
};

type PartName = 'tail' | 'body' | 'pawLeft' | 'pawRight' | 'head';
type PartPlacement = { height: number; left: number; top: number; width: number };

const HEAD = require('../../assets/characters/gray-cat/head.png');
const BODY = require('../../assets/characters/gray-cat/body.png');
const TAIL = require('../../assets/characters/gray-cat/tail.png');
const PAW_LEFT = require('../../assets/characters/gray-cat/paw_left.png');
const PAW_RIGHT = require('../../assets/characters/gray-cat/paw_right.png');

export const GRAY_CAT_BASE_SIZE = 160;

// Coordinates use a 160 x 160 calibration canvas. Each PNG has different
// transparent padding, so these boxes intentionally do not share an origin.
export const GRAY_CAT_BASE_POSE: Record<PartName, PartPlacement> = {
  tail: { left: 0, top: 64, width: 84, height: 84 },
  body: { left: 29, top: 58, width: 102, height: 102 },
  pawLeft: { left: 22, top: 72, width: 68, height: 68 },
  pawRight: { left: 70, top: 70, width: 68, height: 68 },
  head: { left: 24, top: 2, width: 112, height: 112 },
};

const DEBUG_COLORS: Record<PartName, string> = {
  tail: 'rgba(142, 98, 214, 0.65)',
  body: 'rgba(61, 132, 224, 0.65)',
  pawLeft: 'rgba(70, 176, 112, 0.65)',
  pawRight: 'rgba(235, 151, 52, 0.65)',
  head: 'rgba(224, 75, 104, 0.65)',
};

function scaledPlacement(name: PartName, scale: number): PartPlacement {
  const placement = GRAY_CAT_BASE_POSE[name];
  return {
    height: placement.height * scale,
    left: placement.left * scale,
    top: placement.top * scale,
    width: placement.width * scale,
  };
}

function debugStyle(name: PartName, showDebug: boolean): ViewStyle | undefined {
  return showDebug ? { borderColor: DEBUG_COLORS[name], borderWidth: 1 } : undefined;
}

export function GrayCatActor({ size = GRAY_CAT_BASE_SIZE, state = 'idle', quote, showQuote = false, showDebug = false }: GrayCatActorProps) {
  const [floatMotion] = useState(() => new Animated.Value(0));
  const [tailMotion] = useState(() => new Animated.Value(0));
  const scale = size / GRAY_CAT_BASE_SIZE;

  useEffect(() => {
    floatMotion.stopAnimation();
    tailMotion.stopAnimation();
    floatMotion.setValue(0);
    tailMotion.setValue(0);

    if (state !== 'idle') return;

    const animation = Animated.parallel([
      Animated.loop(Animated.sequence([
        Animated.timing(floatMotion, { duration: 1200, toValue: 1, useNativeDriver: true }),
        Animated.timing(floatMotion, { duration: 1200, toValue: 0, useNativeDriver: true }),
      ])),
      Animated.loop(Animated.sequence([
        Animated.timing(tailMotion, { duration: 760, toValue: 1, useNativeDriver: true }),
        Animated.timing(tailMotion, { duration: 760, toValue: 0, useNativeDriver: true }),
      ])),
    ]);

    animation.start();
    return () => animation.stop();
  }, [floatMotion, state, tailMotion]);

  const bodyY = floatMotion.interpolate({ inputRange: [0, 1], outputRange: [0, -2 * scale] });
  const headY = floatMotion.interpolate({ inputRange: [0, 1], outputRange: [0, -1.5 * scale] });
  const tailRotate = tailMotion.interpolate({ inputRange: [0, 1], outputRange: ['-3deg', '4deg'] });

  return (
    <View accessibilityLabel={`灰白貓，${state}`} style={[styles.canvas, { height: size, width: size }]}>
      {showQuote && quote ? (
        <View pointerEvents="none" style={[styles.quoteBubble, { maxWidth: Math.max(112, size * 1.9) }]}>
          <Text numberOfLines={3} style={styles.quoteText}>{quote}</Text>
        </View>
      ) : null}

      <Animated.View style={[styles.part, scaledPlacement('tail', scale), debugStyle('tail', showDebug), { transform: [{ rotate: tailRotate }] }]}>
        <Image resizeMode="contain" source={TAIL} style={styles.image} />
      </Animated.View>

      <Animated.View style={[styles.part, scaledPlacement('body', scale), debugStyle('body', showDebug), { transform: [{ translateY: bodyY }] }]}>
        <Image resizeMode="contain" source={BODY} style={styles.image} />
      </Animated.View>

      <View style={[styles.part, scaledPlacement('pawLeft', scale), debugStyle('pawLeft', showDebug)]}>
        <Image resizeMode="contain" source={PAW_LEFT} style={styles.image} />
      </View>

      <View style={[styles.part, scaledPlacement('pawRight', scale), debugStyle('pawRight', showDebug)]}>
        <Image resizeMode="contain" source={PAW_RIGHT} style={styles.image} />
      </View>

      <Animated.View style={[styles.part, scaledPlacement('head', scale), debugStyle('head', showDebug), { transform: [{ translateY: headY }] }]}>
        <Image resizeMode="contain" source={HEAD} style={styles.image} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { position: 'relative' },
  part: { position: 'absolute' },
  image: { height: '100%', width: '100%' },
  quoteBubble: { backgroundColor: '#FFFFFF', borderColor: '#E9D8CB', borderRadius: 12, borderWidth: 1, bottom: '78%', left: '62%', paddingHorizontal: 8, paddingVertical: 5, position: 'absolute', zIndex: 10 },
  quoteText: { color: '#6B5548', fontSize: 10, lineHeight: 13 },
});
