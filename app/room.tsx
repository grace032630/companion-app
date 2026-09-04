import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

const NUDGES = [
  { icon: '👉', label: '推你一把', message: '先動一下就好，第一步最難。' },
  { icon: '👊', label: '揍一拳', message: '欸，別再滑了，回去開工！' },
  { icon: '🤝', label: '手牽手', message: '我陪你一起做，現在開始。' },
  { icon: '🫶', label: '哄著你做', message: '不用一次做好，先做一小步就很棒了。' },
];

export default function RoomScreen() {
  const params = useLocalSearchParams<{ task?: string }>();
  const [finished, setFinished] = useState(false);
  const [nudgeMessage, setNudgeMessage] = useState('不用急，我們先一起做第一步就好。');

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
          <Text style={styles.roomEyebrow}>LET'S DO THIS TOGETHER</Text>
          <Text style={styles.roomTitle}>{finished ? '今天有動就算進度 ^^' : '有人陪你一起開工'}</Text>

          <View style={styles.scene}>
            <View style={styles.personSpot}>
              <Text style={styles.personName}>小狐狸</Text>
              <Text style={styles.smallAnimal}>🦊</Text>
              <Text style={styles.personState}>也在努力中</Text>
            </View>

            <View style={styles.youSpot}>
              <Text style={styles.youLabel}>YOU</Text>
              <Text style={styles.mainAnimal}>🐻</Text>
              <Text style={styles.hammer}>🔨</Text>
            </View>

            <View style={styles.personSpot}>
              <Text style={styles.personName}>小兔</Text>
              <Text style={styles.smallAnimal}>🐰</Text>
              <Text style={styles.personState}>也在努力中</Text>
            </View>
          </View>

          <Text style={styles.taskLabel}>你正在做</Text>
          <Text style={styles.taskTitle}>{params.task || '一件小事'}</Text>
        </View>

        <View style={styles.supportBubble}>
          <Text style={styles.supportIcon}>🫶</Text>
          <Text style={styles.supportText}>{finished ? '可以休息了，今天有開始就很好。' : nudgeMessage}</Text>
        </View>

        {!finished ? (
          <>
            <Text style={styles.sectionTitle}>房間裡的人可以這樣陪你</Text>
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

            <Pressable onPress={() => setFinished(true)} style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}>
              <Text style={styles.doneButtonText}>我做完了</Text>
            </Pressable>
          </>
        ) : (
          <Pressable onPress={() => router.replace('/')} style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}>
            <Text style={styles.doneButtonText}>回首頁</Text>
          </Pressable>
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
  scene: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'center', marginTop: 28, width: '100%' },
  personSpot: { alignItems: 'center', flex: 1 },
  personName: { color: '#745E50', fontSize: 11, fontWeight: '700', marginBottom: 4 },
  personState: { color: '#9A8475', fontSize: 10, marginTop: 4 },
  smallAnimal: { fontSize: 48 },
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
  taskLabel: { color: '#9A8171', fontSize: 11, marginTop: 24 },
  taskTitle: { color: '#493D34', fontSize: 24, fontWeight: '800', marginTop: 5 },
  supportBubble: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#EDDED2',
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 18,
    padding: 18,
  },
  supportIcon: { fontSize: 28, marginRight: 12 },
  supportText: { color: '#715A4C', flex: 1, fontSize: 14, fontWeight: '600', lineHeight: 21 },
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
  doneButton: { alignItems: 'center', backgroundColor: '#A86F4D', borderRadius: 18, justifyContent: 'center', marginTop: 26, minHeight: 56 },
  doneButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.72 },
});
