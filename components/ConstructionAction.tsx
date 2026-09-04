import { StyleSheet, Text, View } from 'react-native';

import { CONSTRUCTION_ACTIONS } from '../constants/crew';
import type { ConstructionActionId } from '../types/crew';

type ConstructionActionProps = {
  action: ConstructionActionId;
  emphasized?: boolean;
};

export function ConstructionAction({ action, emphasized = false }: ConstructionActionProps) {
  const content = CONSTRUCTION_ACTIONS[action];

  return (
    <View style={styles.container}>
      <Text style={[styles.emoji, emphasized && styles.emphasizedEmoji]}>{content.emoji}</Text>
      <Text style={[styles.label, emphasized && styles.emphasizedLabel]}>{content.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  emoji: {
    fontSize: 21,
  },
  emphasizedEmoji: {
    fontSize: 30,
  },
  label: {
    color: '#8B7363',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 5,
  },
  emphasizedLabel: {
    fontSize: 11,
  },
});
