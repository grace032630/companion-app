import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { CONSTRUCTION_ACTIONS } from '../constants/crew';
import type { ConstructionActionId } from '../types/crew';

type ConstructionActionProps = { action: ConstructionActionId; emphasized?: boolean };

export function ConstructionAction({ action, emphasized = false }: ConstructionActionProps) {
  const content = CONSTRUCTION_ACTIONS[action];
  const [motion] = useState(() => new Animated.Value(0));
  const [phase] = useState(() => Math.floor(Math.random() * 360));

  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.delay(phase),
      Animated.timing(motion, { duration: 430, toValue: 1, useNativeDriver: true }),
      Animated.timing(motion, { duration: 430, toValue: 0, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [motion, phase]);

  const rotation = motion.interpolate({
    inputRange: [0, 1],
    outputRange: action === 'hammering' || action === 'screwing' ? ['-12deg', '16deg'] : ['-3deg', '3deg'],
  });
  const translateY = motion.interpolate({ inputRange: [0, 1], outputRange: [0, action === 'carrying-box' || action === 'carrying-wood' ? -3 : -1] });

  return (
    <View style={styles.container}>
      <Animated.Text style={[styles.emoji, emphasized && styles.emphasizedEmoji, { transform: [{ rotate: rotation }, { translateY }] }]}>{content.emoji}</Animated.Text>
      <Text style={[styles.label, emphasized && styles.emphasizedLabel]}>{content.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:{alignItems:'center'}, emoji:{fontSize:21}, emphasizedEmoji:{fontSize:28}, label:{color:'#745F52',fontSize:9,fontWeight:'800',marginTop:3}, emphasizedLabel:{fontSize:10}
});
