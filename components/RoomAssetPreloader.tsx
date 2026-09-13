import { preload } from 'expo-audio';
import { Image, StyleSheet, View } from 'react-native';

const ROOM_BACKGROUNDS = [
  require('../assets/backgrounds/room-day.png'),
  require('../assets/backgrounds/room-day-2.png'),
  require('../assets/backgrounds/room-day-3.png'),
  require('../assets/backgrounds/room-day-4.png'),
  require('../assets/backgrounds/room-day-5.png'),
  require('../assets/backgrounds/room-night-1.png'),
  require('../assets/backgrounds/room-night-2.png'),
  require('../assets/backgrounds/room-night-3.png'),
] as const;

const ROOM_AUDIO = [
  require('../assets/audio/room-bgm.mp3'),
  require('../assets/audio/room-bgm-2.mp3'),
  require('../assets/audio/room-bgm-3.mp3'),
  require('../assets/audio/room-bgm-4.mp3'),
  require('../assets/audio/room-bgm-5.mp3'),
] as const;

// expo-audio may preload synchronously on some platforms (notably web), so do
// not assume preload() returns a Promise.
ROOM_AUDIO.forEach((source) => {
  try {
    const result = preload(source);
    if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
      Promise.resolve(result).catch(() => undefined);
    }
  } catch {
    // Preloading is only an optimization; room playback can still load normally.
  }
});

export function RoomAssetPreloader() {
  return (
    <View pointerEvents="none" style={styles.hidden}>
      {ROOM_BACKGROUNDS.map((source, index) => (
        <Image key={index} source={source} style={styles.image} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: {
    height: 1,
    left: 0,
    opacity: 0,
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
    width: 1,
    zIndex: -1,
  },
  image: {
    height: 1,
    width: 1,
  },
});
