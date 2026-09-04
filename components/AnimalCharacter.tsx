import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

import type { AnimalAnimationState } from '../types/crew';

type AnimalCharacterProps = {
  animal: string;
  state: AnimalAnimationState;
  size?: 'small' | 'regular' | 'large';
};

export function AnimalCharacter({ animal, state, size = 'regular' }: AnimalCharacterProps) {
  const [translateX] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(0));
  const [scale] = useState(() => new Animated.Value(1));
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    translateX.stopAnimation();
    translateY.stopAnimation();
    scale.stopAnimation();
    opacity.stopAnimation();
    translateX.setValue(0);
    translateY.setValue(0);
    scale.setValue(1);
    opacity.setValue(state === 'idle' ? 0.68 : 1);

    let animation: Animated.CompositeAnimation | undefined;

    if (state === 'working') {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(translateY, { duration: 420, toValue: -3, useNativeDriver: true }),
          Animated.timing(translateY, { duration: 420, toValue: 0, useNativeDriver: true }),
        ]),
      );
    } else if (state === 'pushed') {
      scale.setValue(0.92);
      animation = Animated.sequence([
        Animated.spring(scale, { bounciness: 18, speed: 24, toValue: 1.12, useNativeDriver: true }),
        Animated.spring(scale, { bounciness: 8, speed: 20, toValue: 1, useNativeDriver: true }),
      ]);
    } else if (state === 'punched') {
      animation = Animated.sequence([
        Animated.timing(translateX, { duration: 55, toValue: -12, useNativeDriver: true }),
        Animated.timing(translateX, { duration: 55, toValue: 12, useNativeDriver: true }),
        Animated.timing(translateX, { duration: 55, toValue: -9, useNativeDriver: true }),
        Animated.timing(translateX, { duration: 55, toValue: 9, useNativeDriver: true }),
        Animated.timing(translateX, { duration: 55, toValue: 0, useNativeDriver: true }),
      ]);
    } else if (state === 'done') {
      animation = Animated.sequence([
        Animated.spring(scale, { bounciness: 20, speed: 20, toValue: 1.14, useNativeDriver: true }),
        Animated.spring(scale, { bounciness: 10, speed: 18, toValue: 1, useNativeDriver: true }),
      ]);
    }

    animation?.start();

    return () => animation?.stop();
  }, [opacity, scale, state, translateX, translateY]);

  return (
    <Animated.View
      accessibilityLabel={`動物角色，狀態：${state}`}
      style={{ opacity, transform: [{ translateX }, { translateY }, { scale }] }}>
      <Text style={[styles.animal, size === 'small' && styles.smallAnimal, size === 'large' && styles.largeAnimal]}>
        {animal}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  animal: {
    fontSize: 37,
  },
  smallAnimal: {
    fontSize: 27,
  },
  largeAnimal: {
    fontSize: 66,
  },
});
