import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

const MODE_COPY: Record<string, { label: string; message: string }> = {
  together: { label: '🤝 手牽手一起做', message: '不用衝很快，我們一起把第一步做起來。' },
  quiet: { label: '🌙 安靜陪伴', message: '這裡不用聊天，安靜做自己的事就好。' },
  coax: { label: '🫶 哄著我做', message: '乖乖先做一點點就好，做完再回來休息。' },
};

const NUDGES = [
  { icon: '👉', label: '推你一把', message: '先動一下就好，第一步最難。' },
  { icon: '👊', label: '揍一拳', message: '欸，別再滑了，回去開工！' },
  { icon: '🤝', label: '手牽手', message: '我陪你一起做，現在開始。' },
  { icon: '🫶', label: '哄著你做', message: '你不用一次做好，先做一小格就很棒了。' },
];

function durationToSeconds(value: string | undefined) {
  if (!value || value === '不確定') return 15 * 60;
  const minutes = Number.parseInt(value, 10);
  return Number.isFinite(minutes) ? minutes * 60 : 15 * 60;
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function RoomScreen() {
  const params = useLocalSearchParams<{ task?: string; duration?: string; mode?: string }>();
  const initialSeconds = useMemo(() => durationToSeconds(params.duration), [params.duration]);
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
  const [running, setRunning] = useState(true);
  const [finished, setFinished] = useState(false);
  const [nudgeMessage, setNudgeMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!running || finished) return;

    const timer = setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          setRunning(false);
          setFinished(true);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [running, finished]);

  const mode = MODE_COPY[params.mode ?? 'quiet'] ?? MODE_COPY.quiet;

  const finishNow = () => {
    setSecondsLeft(0);
    setRunning(false);
    setFinished(true);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <Text style={styles.brand}>Companion</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.roomCard}>
          <Text style={styles.roomEyebrow}>YOUR LITTLE WORK CORNER</Text>
          <Text style={styles.roomTitle}>{finished ? '今天先做到這裡 ♡' : '小動物們正在陪你開工'}</Text>
          <Text style={styles.modeText}>{mode.label}</Text>

          <View style={styles.scene}>
            <View style={styles.helperAnimal}>
              <Text style={styles.smallAnimal}>🦊</Text>
              <Text style={styles.tool}>🪚</Text>
            </View>
            <View style={styles.youSpot}>
              <Text style={styles.youLabel}>YOU</Text>
              <Text style={styles.mainAnimal}>🐻</Text>
              <Text style={styles.hammer}>🔨</Text>
            </View>
            <View style={styles.helperAnimal}>
              <Text style={styles.smallAnimal}>🐰</Text>
              <Text style={styles.tool}>🪛</Text>
            </View>
          </View>

          <Text style={styles.sceneNote}>這些是陪伴角色，不是假裝成真人使用者。</Text>
        </View>

        <View style={styles.taskCard}>
          <Text style={styles.taskLabel}>現在正在做</Text>
          <Text style={styles.taskTitle}>{params.task || '一件小事'}</Text>
          <Text style={styles.encouragement}>{finished ? '有開始就算進度。休息一下也可以。' : mode.message}</Text>

          <Text style={styles.timer}>{formatTime(secondsLeft)}</Text>

          {!finished ? (
            <View style={styles.timerActions}>
              <Pressable
                onPress={() => setRunning((value) => !value)}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                <Text style={styles.secondaryButtonText}>{running ? '暫停一下' : '繼續開工'}</Text>
              </Pressable>
              <Pressable onPress={finishNow} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                <Text style={styles.primaryButtonText}>我做完了</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => router.replace('/')} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <Text style={styles.primaryButtonText}>回首頁</Text>
            </Pressable>
          )}
        </View>

        {!finished && (
          <>
            <Text style={styles.sectionTitle}>需要再推一下嗎？</Text>
            <View style={styles.nudgeGrid}>
              {NUDGES.map((item) => (
                <Pressable
                  key={item.label}
                  onPress={() => setNudgeMessage(item.message)}
                  style={({ pressed }) => [styles.nudgeCard, pressed && styles.pressed]}>
                  <Text style={styles.nudgeIcon}>{item.icon}</Text>
                  <Text style={styles.nudgeLabel}>{item.label}</Text>
                </Pressable>
              ))}
            </View>

            {nudgeMessage && (
              <View style={styles.messageBubble}>
                <Text style={styles.messageText}>{nudgeMessage}</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#FFF9F1', flex: 1 },
  content: { paddingBottom: 36, paddingHorizontal: 24, paddingTop: 14 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  backButton: { alignItems: 'center', height: 42, justifyContent: 'center', width: 42 },
  backText: { color: '#6F5748', fontSize: 36, lineHeight: 38 },
  brand: { color: '#493D34', fontSize: 20, fontWeight: '700' },
  headerSpacer: { width: 42 },
  roomCard: {
    alignItems: 'center',
    backgroundColor: '#F9E9DB',
    borderColor: '#E8CEBB',
    borderRadius: 30,
    borderWidth: 1,
    marginTop: 18,
    padding: 24,
  },
  roomEyebrow: { color: '#A36E50', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  roomTitle: { color: '#493D34', fontSize: 22, fontWeight: '800', marginTop: 10, textAlign: 'center' },
  modeText: { color: '#806C5E', fontSize: 13, marginTop: 8 },
  scene: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 28,
    minHeight: 130,
    width: '100%',
  },
  helperAnimal: { alignItems: 'center', marginHorizontal: 8 },
  smallAnimal: { fontSize: 48 },
  tool: { fontSize: 22, marginTop: -4 },
  youSpot: {
    alignItems: 'center',
    backgroundColor: '#FFF8F1',
    borderColor: '#D9B9A2',
    borderRadius: 24,
    borderWidth: 1,
    marginHorizontal: 6,
    paddingBottom: 13,
    paddingHorizontal: 18,
    paddingTop: 9,
  },
  youLabel: { color: '#A36E50', fontSize: 9, fontWeight: '800', letterSpacing: 1.3 },
  mainAnimal: { fontSize: 64, marginTop: 2 },
  hammer: { fontSize: 24, marginTop: -8 },
  sceneNote: { color: '#A18A7A', fontSize: 10, marginTop: 18, textAlign: 'center' },
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EDDED2',
    borderRadius: 26,
    borderWidth: 1,
    marginTop: 18,
    padding: 22,
  },
  taskLabel: { color: '#A36E50', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  taskTitle: { color: '#493D34', fontSize: 24, fontWeight: '800', marginTop: 7 },
  encouragement: { color: '#88766A', fontSize: 14, lineHeight: 22, marginTop: 8 },
  timer: { color: '#493D34', fontSize: 48, fontWeight: '700', letterSpacing: 2, marginVertical: 22, textAlign: 'center' },
  timerActions: { flexDirection: 'row', gap: 10 },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#D8C1B0',
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
  },
  secondaryButtonText: { color: '#765C4D', fontSize: 14, fontWeight: '700' },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#A86F4D',
    borderRadius: 16,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  sectionTitle: { color: '#493D34', fontSize: 18, fontWeight: '800', marginBottom: 12, marginTop: 26 },
  nudgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  nudgeCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E7D7C8',
    borderRadius: 18,
    borderWidth: 1,
    flexBasis: '47%',
    flexGrow: 1,
    padding: 15,
  },
  nudgeIcon: { fontSize: 25 },
  nudgeLabel: { color: '#604E43', fontSize: 13, fontWeight: '700', marginTop: 7 },
  messageBubble: { backgroundColor: '#F2D9C4', borderRadius: 18, marginTop: 14, padding: 16 },
  messageText: { color: '#6E432C', fontSize: 14, fontWeight: '600', lineHeight: 21, textAlign: 'center' },
  pressed: { opacity: 0.72 },
});
