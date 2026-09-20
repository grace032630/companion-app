import { useEffect, useState } from 'react';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';

import {
  claimRoomStrawberry,
  fetchRoomStrawberries,
  subscribeToRoomStrawberries,
  type RoomStrawberry,
} from '../lib/room-strawberries';
import { supabase } from '../lib/supabase';

type Props = {
  roomId: string;
  soundEnabled?: boolean;
};

const PICKUP_SOUND = require('../assets/audio/strawberry-pickup.wav');

function playLightHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
    if (Platform.OS === 'android') Vibration.vibrate(10);
  });
}

export function RoomStrawberryOverlay({ roomId, soundEnabled = true }: Props) {
  const [berries, setBerries] = useState<RoomStrawberry[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const pickupPlayer = useAudioPlayer(PICKUP_SOUND);

  useEffect(() => {
    pickupPlayer.volume = 0.55;
  }, [pickupPlayer]);

  useEffect(() => {
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const refresh = async () => {
      const next = await fetchRoomStrawberries(roomId);
      if (active) setBerries(next);
    };

    const refreshWithRetry = async () => {
      try {
        await refresh();
      } catch {
        attempts += 1;
        if (active && attempts < 30) retryTimer = setTimeout(() => void refreshWithRetry(), 500);
      }
    };

    void refreshWithRetry();
    const channel = subscribeToRoomStrawberries(roomId, () => {
      void refresh().catch(() => undefined);
    });

    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
      void supabase.removeChannel(channel);
    };
  }, [roomId]);

  const showMessage = (text: string, duration: number) => {
    setMessage(text);
    setTimeout(() => setMessage(null), duration);
  };

  const playPickupFeedback = () => {
    playLightHaptic();
    if (!soundEnabled) return;
    try {
      pickupPlayer.seekTo(0);
      pickupPlayer.play();
    } catch {
      // Sound is optional; claiming the strawberry must still succeed.
    }
  };

  const handleClaim = async (berry: RoomStrawberry) => {
    if (claimingId) return;
    setClaimingId(berry.id);
    try {
      const claimed = await claimRoomStrawberry(berry.id);
      setBerries((current) => current.filter((item) => item.id !== berry.id));
      if (claimed) {
        playPickupFeedback();
        showMessage('🍓 撿到草莓 +1', 1300);
      } else {
        showMessage('被別人搶先撿走了！', 1100);
      }
    } catch {
      showMessage('剛剛沒撿到，再試一次～', 1100);
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      {berries.map((berry) => (
        <Pressable
          accessibilityLabel="撿草莓"
          disabled={claimingId === berry.id}
          key={berry.id}
          onPress={() => void handleClaim(berry)}
          style={({ pressed }) => [
            styles.berry,
            { left: `${berry.x_percent}%`, top: `${berry.y_percent}%` },
            pressed && styles.berryPressed,
          ]}
        >
          <Text style={styles.berryEmoji}>🍓</Text>
        </Pressable>
      ))}
      {message ? (
        <View pointerEvents="none" style={styles.toast}>
          <Text style={styles.toastText}>{message}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    borderRadius: 28,
    height: 610,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 16,
    zIndex: 100,
  },
  berry: {
    alignItems: 'center',
    height: 50,
    justifyContent: 'center',
    marginLeft: -25,
    marginTop: -25,
    position: 'absolute',
    width: 50,
    zIndex: 110,
  },
  berryPressed: {
    opacity: 0.65,
    transform: [{ scale: 0.86 }],
  },
  berryEmoji: {
    fontSize: 34,
    textShadowColor: 'rgba(80,45,35,0.22)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
  toast: {
    alignSelf: 'center',
    backgroundColor: 'rgba(78,64,55,0.94)',
    borderColor: 'rgba(255,255,255,0.28)',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 9,
    position: 'absolute',
    top: 82,
    zIndex: 300,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
});
