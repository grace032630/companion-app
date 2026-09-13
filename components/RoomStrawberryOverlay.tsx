import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../lib/auth';
import { fetchOwnActiveRoomSession } from '../lib/room-realtime';
import {
  claimRoomStrawberry,
  ensureRoomStrawberries,
  fetchRoomStrawberries,
  subscribeToRoomStrawberries,
  type RoomStrawberry,
} from '../lib/room-strawberries';
import { supabase } from '../lib/supabase';

export function RoomStrawberryOverlay() {
  const { session } = useAuth();
  const [roomId, setRoomId] = useState<string | null>(null);
  const [berries, setBerries] = useState<RoomStrawberry[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) return;

    let active = true;
    let attempts = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const findRoom = async () => {
      try {
        const roomSession = await fetchOwnActiveRoomSession(userId);
        if (!active) return;
        if (roomSession?.room_id) {
          setRoomId(roomSession.room_id);
          return;
        }
      } catch {
        // The room screen may still be creating its session.
      }

      attempts += 1;
      if (active && attempts < 12) retryTimer = setTimeout(() => void findRoom(), 500);
    };

    void findRoom();

    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [session?.user.id]);

  useEffect(() => {
    if (!roomId) return;
    let active = true;

    const refresh = async () => {
      try {
        const next = await fetchRoomStrawberries(roomId);
        if (active) setBerries(next);
      } catch {
        if (active) setBerries([]);
      }
    };

    const start = async () => {
      try {
        await ensureRoomStrawberries();
      } catch {
        // If seeding races with room setup, the existing room data is still safe.
      }
      await refresh();
    };

    void start();
    const channel = subscribeToRoomStrawberries(roomId, () => void refresh());

    return () => {
      active = false;
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
      if (claimed) showMessage('🍓 撿到草莓 +1', 1300);
      else showMessage('被別人搶先撿走了！', 1100);
    } catch {
      showMessage('剛剛沒撿到，再試一次～', 1100);
    } finally {
      setClaimingId(null);
    }
  };

  if (!roomId) return null;

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <View pointerEvents="box-none" style={styles.playArea}>
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
      </View>
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
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 50,
  },
  playArea: {
    bottom: 150,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 150,
  },
  berry: {
    alignItems: 'center',
    height: 46,
    justifyContent: 'center',
    marginLeft: -23,
    marginTop: -23,
    position: 'absolute',
    width: 46,
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
    backgroundColor: 'rgba(78,64,55,0.90)',
    borderRadius: 16,
    bottom: 122,
    paddingHorizontal: 16,
    paddingVertical: 9,
    position: 'absolute',
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
