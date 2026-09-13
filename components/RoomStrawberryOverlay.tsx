import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';

import {
  claimRoomStrawberry,
  ensureRoomStrawberries,
  fetchRoomStrawberries,
  subscribeToRoomStrawberries,
  type RoomStrawberry,
} from '../lib/room-strawberries';
import { supabase } from '../lib/supabase';

type Props = {
  roomId: string;
};

function playPickupFeedback() {
  Vibration.vibrate(35);

  if (Platform.OS !== 'web' || typeof window === 'undefined') return;

  try {
    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    const context = new AudioContextCtor();
    const gain = context.createGain();
    const first = context.createOscillator();
    const second = context.createOscillator();
    const now = context.currentTime;

    first.type = 'sine';
    first.frequency.setValueAtTime(740, now);
    second.type = 'sine';
    second.frequency.setValueAtTime(980, now + 0.07);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    first.connect(gain);
    second.connect(gain);
    gain.connect(context.destination);

    first.start(now);
    first.stop(now + 0.12);
    second.start(now + 0.07);
    second.stop(now + 0.22);

    window.setTimeout(() => void context.close(), 320);
  } catch {
    // Sound feedback is optional; pickup should still succeed.
  }
}

export function RoomStrawberryOverlay({ roomId }: Props) {
  const [berries, setBerries] = useState<RoomStrawberry[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const refresh = async () => {
      const next = await fetchRoomStrawberries(roomId);
      if (active) setBerries(next);
    };

    const seedAndRefresh = async () => {
      try {
        await ensureRoomStrawberries();
        await refresh();
      } catch {
        attempts += 1;
        if (active && attempts < 30) retryTimer = setTimeout(() => void seedAndRefresh(), 500);
      }
    };

    void seedAndRefresh();
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
  // This component now lives inside roomSceneWrap, so only compensate for
  // RoomScene's own 16px top margin. It otherwise shares the exact room bounds.
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
