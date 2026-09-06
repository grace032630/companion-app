import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

import type { AnimalAnimationState } from '../types/crew';

type AnimalCharacterProps = {
  animal: string;
  state: AnimalAnimationState;
  size?: 'small' | 'regular' | 'large';
  scaleMultiplier?: number;
};

export function AnimalCharacter({ animal, state, size = 'regular', scaleMultiplier = 1 }: AnimalCharacterProps) {
  const [translateX] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(0));
  const [scale] = useState(() => new Animated.Value(1));
  const [rotate] = useState(() => new Animated.Value(0));
  const [opacity] = useState(() => new Animated.Value(1));
  const [phase] = useState(() => Math.floor(Math.random() * 420));
  const [tempo] = useState(() => 360 + Math.floor(Math.random() * 230));

  useEffect(() => {
    translateX.stopAnimation(); translateY.stopAnimation(); scale.stopAnimation(); rotate.stopAnimation(); opacity.stopAnimation();
    translateX.setValue(0); translateY.setValue(0); scale.setValue(1); rotate.setValue(0); opacity.setValue(state === 'idle' ? 0.72 : 1);
    let animation: Animated.CompositeAnimation | undefined;

    if (state === 'working') {
      animation = Animated.loop(Animated.sequence([
        Animated.delay(phase),
        Animated.parallel([
          Animated.timing(translateY, { duration: tempo, toValue: -4, useNativeDriver: true }),
          Animated.timing(rotate, { duration: tempo, toValue: 1, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(translateY, { duration: tempo, toValue: 0, useNativeDriver: true }),
          Animated.timing(rotate, { duration: tempo, toValue: 0, useNativeDriver: true }),
        ]),
      ]));
    } else if (state === 'pushed') {
      animation = Animated.sequence([
        Animated.timing(translateX, { duration: 90, toValue: 15, useNativeDriver: true }),
        Animated.spring(translateX, { bounciness: 14, speed: 18, toValue: 0, useNativeDriver: true }),
      ]);
    } else if (state === 'punched') {
      animation = Animated.sequence([
        Animated.timing(translateX, { duration: 55, toValue: -14, useNativeDriver: true }),
        Animated.timing(translateX, { duration: 55, toValue: 13, useNativeDriver: true }),
        Animated.timing(translateX, { duration: 55, toValue: -10, useNativeDriver: true }),
        Animated.timing(translateX, { duration: 55, toValue: 8, useNativeDriver: true }),
        Animated.timing(translateX, { duration: 55, toValue: 0, useNativeDriver: true }),
      ]);
    } else if (state === 'done') {
      animation = Animated.sequence([
        Animated.spring(scale, { bounciness: 20, speed: 20, toValue: 1.18, useNativeDriver: true }),
        Animated.spring(scale, { bounciness: 10, speed: 18, toValue: 1, useNativeDriver: true }),
      ]);
    }

    animation?.start();
    return () => animation?.stop();
  }, [opacity, phase, rotate, scale, state, tempo, translateX, translateY]);

  const rotation = rotate.interpolate({ inputRange: [0, 1], outputRange: ['-2deg', '2deg'] });
  return (
    <Animated.View accessibilityLabel={`動物角色，狀態：${state}`} style={{ opacity, transform: [{ translateX }, { translateY }, { rotate: rotation }, { scale }] }}>
      <Text
        style={[
          styles.animal,
          size === 'small' && styles.smallAnimal,
          size === 'large' && styles.largeAnimal,
          { transform: [{ scale: scaleMultiplier }] },
        ]}
      >
        {animal}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({ animal:{fontSize:37}, smallAnimal:{fontSize:27}, largeAnimal:{fontSize:62} });
