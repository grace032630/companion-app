import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

type BoardItem = {
  id: string;
  animal: string;
  name: string;
  text: string;
  kind: 'working' | 'help' | 'done';
  helper?: boolean;
};

const START_BOARD: BoardItem[] = [
  { id: '1', animal: '🦊', name: 'Mumu', text: '正在整理房間', kind: 'working' },
  { id: '2', animal: '🐰', name: '豆包', text: '正在讀書', kind: 'working', helper: true },
  { id: '3', animal: '🐱', name: 'Yuki', text: '完成了今天的運動 🎉', kind: 'done' },
];

const SUPPORT_MESSAGES = [
  '先動一下下就好，剩下的等一下再說。',
  '我在這裡，你去做第一步就好。',
  '不用做到完美，先開始就可以了。',
  '去吧去吧，我幫你顧著這裡 ^^',
];

export default function RoomScreen() {
  const params = useLocalSearchParams<{ task?: string }>();
  const task = params.task || '一件小事';
  const [finished, setFinished] = useState(false);
  const [askingHelp, setAskingHelp] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const [supportIndex, setSupportIndex] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [board, setBoard] = useState<BoardItem[]>(START_BOARD);

  const askForHelp = () => {
    if (askingHelp || finished) return;
    setAskingHelp(true);
    setNotice('已經幫你喊人了');
    setBoard((items) => [
      { id: `me-help-${Date.now()}`, animal: '🐻', name: '你', text: `做「${task}」做到不想動了，需要幫忙`, kind: 'help' },
      ...items,
    ]);

    setTimeout(() => {
      setNotice('豆包 推了你一把 👉');
      setSupportIndex(1);
    }, 1800);
    setTimeout(() => setNotice('Mumu 揍了你一下 × 3 👊'), 3600);
  };

  const finishTask = () => {
    if (finished) return;
    setFinished(true);
    setAskingHelp(false);
    setNotice('完成啦！已經貼到公告欄 🎉');
    setBoard((items) => [
      { id: `me-done-${Date.now()}`, animal: '🐻', name: '你', text: `完成了「${task}」 🎉`, kind: 'done' },
      ...items.filter((item) => !item.id.startsWith('me-help-')),
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable>
          <Text style={styles.brand}>Companion</Text>
          <Pressable onPress={() => setBoardOpen(true)} style={styles.boardButton}>
            <Text style={styles.boardButtonIcon}>📌</Text>
            <Text style={styles.boardButtonText}>公告欄</Text>
          </Pressable>
        </View>

        <View style={styles.roomCard}>
          <Text style={styles.roomTitle}>{finished ? '做完啦！' : '開工中'}</Text>
          <View style={styles.scene}>
            <Text style={styles.wood}>🪵</Text>
            <View style={styles.youSpot}>
              <Text style={styles.mainAnimal}>🐻</Text>
              <Text style={styles.hammer}>🔨</Text>
            </View>
            <Text style={styles.box}>📦</Text>
          </View>
          <Text style={styles.taskLabel}>現在在做</Text>
          <Text style={styles.taskTitle}>{task}</Text>
        </View>

        <View style={styles.supportBubble}>
          <Text style={styles.supportAnimal}>🐻</Text>
          <Text style={styles.supportText}>{finished ? '嘿嘿，真的做掉了。今天可以記你一功。' : SUPPORT_MESSAGES[supportIndex]}</Text>
        </View>

        {notice && <View style={styles.notice}><Text style={styles.noticeText}>{notice}</Text></View>}

        {!finished ? (
          <View style={styles.actions}>
            <Pressable onPress={askForHelp} style={({ pressed }) => [styles.helpButton, askingHelp && styles.helpButtonActive, pressed && styles.pressed]}>
              <Text style={styles.helpIcon}>🆘</Text>
              <Text style={styles.helpText}>{askingHelp ? '等人來拉我一下' : '幫我'}</Text>
            </Pressable>
            <Pressable onPress={finishTask} style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}>
              <Text style={styles.doneText}>完成任務 ✓</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.actions}>
            <Pressable onPress={() => setBoardOpen(true)} style={styles.helpButton}><Text style={styles.helpText}>看看公告欄</Text></Pressable>
            <Pressable onPress={() => router.replace('/')} style={styles.doneButton}><Text style={styles.doneText}>再做一件</Text></Pressable>
          </View>
        )}
      </ScrollView>

      <Modal visible={boardOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setBoardOpen(false)}>
        <SafeAreaView style={styles.boardSafeArea}>
          <View style={styles.boardHeader}>
            <View><Text style={styles.boardTitle}>📌 公告欄</Text><Text style={styles.boardSubtitle}>看看大家現在在忙什麼</Text></View>
            <Pressable onPress={() => setBoardOpen(false)} style={styles.closeButton}><Text style={styles.closeText}>關閉</Text></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.boardList}>
            {board.map((item) => (
              <View key={item.id} style={[styles.boardItem, item.kind === 'help' && styles.helpItem, item.kind === 'done' && styles.doneItem]}>
                <Text style={styles.boardAnimal}>{item.animal}</Text>
                <View style={styles.boardCopy}>
                  <View style={styles.nameRow}>
                    <Text style={styles.boardName}>{item.name}</Text>
                    {item.helper && <Text style={styles.helperTag}>小幫手</Text>}
                  </View>
                  <Text style={styles.boardText}>{item.text}</Text>
                </View>
                {item.kind === 'working' && <Pressable style={styles.cheerButton}><Text style={styles.cheerText}>加油</Text></Pressable>}
                {item.kind === 'help' && item.name !== '你' && <Pressable style={styles.cheerButton}><Text style={styles.cheerText}>幫他</Text></Pressable>}
                {item.kind === 'done' && <Pressable style={styles.cheerButton}><Text style={styles.cheerText}>🎉</Text></Pressable>}
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  boardButton: { alignItems: 'center', flexDirection: 'row', gap: 4, padding: 8 },
  boardButtonIcon: { fontSize: 16 },
  boardButtonText: { color: '#765C4D', fontSize: 13, fontWeight: '700' },
  roomCard: { alignItems: 'center', backgroundColor: '#F9E9DB', borderColor: '#E8CEBB', borderRadius: 30, borderWidth: 1, marginTop: 18, padding: 24 },
  roomTitle: { color: '#745646', fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  scene: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'center', marginTop: 24, minHeight: 130, width: '100%' },
  youSpot: { alignItems: 'center', backgroundColor: '#FFF8F1', borderColor: '#D9B9A2', borderRadius: 28, borderWidth: 1, marginHorizontal: 18, padding: 16 },
  mainAnimal: { fontSize: 76 },
  hammer: { fontSize: 28, marginTop: -10 },
  wood: { fontSize: 34, marginBottom: 10 },
  box: { fontSize: 34, marginBottom: 8 },
  taskLabel: { color: '#9A8171', fontSize: 11, marginTop: 22 },
  taskTitle: { color: '#493D34', fontSize: 25, fontWeight: '800', marginTop: 5 },
  supportBubble: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#EDDED2', borderRadius: 22, borderWidth: 1, flexDirection: 'row', marginTop: 18, padding: 18 },
  supportAnimal: { fontSize: 30, marginRight: 12 },
  supportText: { color: '#715A4C', flex: 1, fontSize: 15, fontWeight: '600', lineHeight: 22 },
  notice: { alignItems: 'center', backgroundColor: '#F2D9C4', borderRadius: 16, marginTop: 12, padding: 12 },
  noticeText: { color: '#6E432C', fontSize: 13, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 22 },
  helpButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#D8C1B0', borderRadius: 18, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 58 },
  helpButtonActive: { backgroundColor: '#FFF0E5', borderColor: '#C98E69' },
  helpIcon: { fontSize: 16, marginBottom: 2 },
  helpText: { color: '#765C4D', fontSize: 14, fontWeight: '800' },
  doneButton: { alignItems: 'center', backgroundColor: '#A86F4D', borderRadius: 18, flex: 1.25, justifyContent: 'center', minHeight: 58 },
  doneText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  pressed: { opacity: 0.72 },
  boardSafeArea: { backgroundColor: '#FFF9F1', flex: 1 },
  boardHeader: { alignItems: 'center', borderBottomColor: '#EDDED2', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', padding: 24 },
  boardTitle: { color: '#493D34', fontSize: 24, fontWeight: '800' },
  boardSubtitle: { color: '#8A776A', fontSize: 13, marginTop: 5 },
  closeButton: { backgroundColor: '#F2E3D7', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 9 },
  closeText: { color: '#765C4D', fontSize: 13, fontWeight: '700' },
  boardList: { gap: 10, padding: 20 },
  boardItem: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#EDDED2', borderRadius: 20, borderWidth: 1, flexDirection: 'row', padding: 15 },
  helpItem: { backgroundColor: '#FFF0E8', borderColor: '#E3B99E' },
  doneItem: { backgroundColor: '#FFF8E7' },
  boardAnimal: { fontSize: 34, marginRight: 12 },
  boardCopy: { flex: 1 },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  boardName: { color: '#55483E', fontSize: 14, fontWeight: '800' },
  helperTag: { backgroundColor: '#EFE3D8', borderRadius: 8, color: '#8A6D5A', fontSize: 9, overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 2 },
  boardText: { color: '#806E62', fontSize: 12, lineHeight: 18, marginTop: 3 },
  cheerButton: { backgroundColor: '#F2E3D7', borderRadius: 12, marginLeft: 8, paddingHorizontal: 11, paddingVertical: 8 },
  cheerText: { color: '#805E49', fontSize: 12, fontWeight: '800' },
});
