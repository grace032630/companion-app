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
const EYES_CLOSED = require('../../assets/characters/gray-cat/eyes_closed.png');
const EYE_OPEN_LEFT = require('../../assets/characters/gray-cat/eye_open_left.png');
const EYE_OPEN_RIGHT = require('../../assets/characters/gray-cat/eye_open_right.png');

export const GRAY_CAT_BASE_SIZE = 160;

export const GRAY_CAT_BASE_POSE: Record<PartName, PartPlacement> = {
  tail: { left: 6, top: 70, width: 76, height: 76 },
  body: { left: 30, top: 56, width: 100, height: 104 },
  // Forearms should visibly connect from the gray shoulder area and extend outward.
  pawLeft: { left: 12, top: 42, width: 82, height: 82 },
  pawRight: { left: 66, top: 42, width: 82, height: 82 },
  head: { left: 27, top: 6, width: 106, height: 106 },
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

export function GrayCatActor({
  size = GRAY_CAT_BASE_SIZE,
  state = 'idle',
  quote,
  showQuote = false,
  showDebug = false,
}: GrayCatActorProps) {
  const [floatMotion] = useState(() => new Animated.Value(0));
  const [tailMotion] = useState(() => new Animated.Value(0));
  const [pawMotion] = useState(() => new Animated.Value(0));
  const scale = size / GRAY_CAT_BASE_SIZE;

  useEffect(() => {
    floatMotion.stopAnimation();
    tailMotion.stopAnimation();
    pawMotion.stopAnimation();
    floatMotion.setValue(0);
    tailMotion.setValue(0);
    pawMotion.setValue(0);

    if (state === 'help') return;

    const loops: Animated.CompositeAnimation[] = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatMotion, { duration: 950, toValue: 1, useNativeDriver: true }),
          Animated.timing(floatMotion, { duration: 950, toValue: 0, useNativeDriver: true }),
        ]),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(tailMotion, { duration: 700, toValue: 1, useNativeDriver: true }),
          Animated.timing(tailMotion, { duration: 700, toValue: 0, useNativeDriver: true }),
        ]),
      ),
    ];

    if (state === 'working') {
      loops.push(
        Animated.loop(
          Animated.sequence([
            Animated.timing(pawMotion, { duration: 280, toValue: 1, useNativeDriver: true }),
            Animated.timing(pawMotion, { duration: 280, toValue: 0, useNativeDriver: true }),
          ]),
        ),
      );
    }

    const animation = Animated.parallel(loops);
    animation.start();
    return () => animation.stop();
  }, [floatMotion, pawMotion, state, tailMotion]);

  const bodyY = floatMotion.interpolate({ inputRange: [0, 1], outputRange: [0, -2.5 * scale] });
  const headY = floatMotion.interpolate({ inputRange: [0, 1], outputRange: [0, -2 * scale] });
  const tailRotate = tailMotion.interpolate({ inputRange: [0, 1], outputRange: ['-6deg', '7deg'] });

  // The left/right paw files both face the same way. Mirror only the left one
  // so both paw tips point inward toward the cat's chest.
  const leftPawRotate = pawMotion.interpolate({ inputRange: [0, 1], outputRange: ['8deg', '18deg'] });
  const rightPawRotate = pawMotion.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '-18deg'] });

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

      <Animated.View
        style={[
          styles.part,
          scaledPlacement('pawLeft', scale),
          debugStyle('pawLeft', showDebug),
          { transform: [{ scaleX: -1 }, { rotate: leftPawRotate }] },
        ]}
      >
        <Image resizeMode="contain" source={PAW_LEFT} style={styles.image} />
      </Animated.View>

      <Animated.View
        style={[
          styles.part,
          scaledPlacement('pawRight', scale),
          debugStyle('pawRight', showDebug),
          { transform: [{ rotate: rightPawRotate }] },
        ]}
      >
        <Image resizeMode="contain" source={PAW_RIGHT} style={styles.image} />
      </Animated.View>

      <Animated.View style={[styles.part, scaledPlacement('head', scale), debugStyle('head', showDebug), { transform: [{ translateY: headY }] }]}>
        <Image resizeMode="contain" source={HEAD} style={styles.image} />

        {state === 'help' ? (
          <>
            <Image
              pointerEvents="none"
              resizeMode="contain"
              source={EYE_OPEN_LEFT}
              style={styles.openEyeLeft}
            />
            <Image
              pointerEvents="none"
              resizeMode="contain"
              source={EYE_OPEN_RIGHT}
              style={styles.openEyeRight}
            />
          </>
        ) : (
          <Image
            pointerEvents="none"
            resizeMode="contain"
            source={EYES_CLOSED}
            style={styles.closedEyes}
          />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { position: 'relative' },
  part: { position: 'absolute' },
  image: { height: '100%', width: '100%' },

  // Open eyes are separate assets so eye spacing can be tuned without
  // stretching the eyeballs themselves.
  openEyeLeft: {
    height: '24%',
    left: '21%',
    position: 'absolute',
    top: '30%',
    width: '24%',
  },
  openEyeRight: {
    height: '24%',
    position: 'absolute',
    right: '21%',
    top: '30%',
    width: '24%',
  },
  // eyes_closed.png uses a small 160x160 calibration canvas. It needs to sit
  // lower on the face than before.
  closedEyes: {
    height: '50%',
    left: '13%',
    position: 'absolute',
    top: '50%',
    transform: [{ scaleX: 2.32 }],
    width: '74%',
  },

  quoteBubble: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E9D8CB',
    borderRadius: 12,
    borderWidth: 1,
    bottom: '78%',
    left: '62%',
    paddingHorizontal: 8,
    paddingVertical: 5,
    position: 'absolute',
    zIndex: 10,
  },
  quoteText: { color: '#6B5548', fontSize: 10, lineHeight: 13 },
});
