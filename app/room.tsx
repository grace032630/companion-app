import { useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, Vibration, View } from 'react-native';
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

const ANIMALS = ['🐱', '🐶', '🐰', '🦊', '🐻', '🐼', '🐹', '🐯'];
const NAMES = ['小橘', '阿灰', '奶糖', '豆包', '栗子', '麻糬', 'Mumu', 'Yuki', '布丁', '小麥', '米米', '阿福'];
const TASKS = ['整理房間', '讀書', '運動', '工作', '洗衣服', '寫報告', '收桌子'];

const SUPPORT_MESSAGES = [
  '欸 都進來了 就差真的動手了',
  '手機先放下 去做一下啦',
  '先碰它一下就好 不要想整件事',
  '先做兩分鐘 不爽再回來',
  '起來啦 先把第一個東西拿起來',
  '現在就去 我在這裡等你',
  '不要等有動力 動了再說',
  '做爛也沒差 先做再說',
];

function pick<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function makeNpc(id: string, kind: BoardItem['kind'] = 'working', helper = false): BoardItem {
  const task = pick(TASKS);
  return {
    id,
    animal: pick(ANIMALS),
    name: pick(NAMES),
    kind,
    helper,
    text: kind === 'done' ? `完成了「${task}」 🎉` : kind === 'help' ? `做「${task}」卡住了 需要幫忙` : `正在做「${task}」`,
  };
}

export default function RoomScreen() {
  const params = useLocalSearchParams<{ task?: string }>();
  const task = params.task || '一件小事';
  const [me] = useState(() => ({ animal: pick(ANIMALS), name: pick(NAMES) }));
  const [finished, setFinished] = useState(false);
  const [askingHelp, setAskingHelp] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const [supportIndex, setSupportIndex] = useState(() => Math.floor(Math.random() * SUPPORT_MESSAGES.length));
  const [notice, setNotice] = useState<string | null>(null);
  const [pushText, setPushText] = useState<string | null>(null);
  const pushScale = useRef(new Animated.Value(0.92)).current;
  const [board, setBoard] = useState<BoardItem[]>(() => [makeNpc('1'), makeNpc('2', 'working', true), makeNpc('3', 'done')]);

  const showPush = (text: string, supportMessageIndex: number) => {
    setPushText(text);
    setSupportIndex(supportMessageIndex);
    Vibration.vibrate(90);
    pushScale.setValue(0.9);
    Animated.sequence([
      Animated.spring(pushScale, { toValue: 1.08, useNativeDriver: true, speed: 24, bounciness: 16 }),
      Animated.spring(pushScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 10 }),
    ]).start();
  };

  const askForHelp = () => {
    if (askingHelp || finished) return;
    setAskingHelp(true);
    setNotice('已經喊幫我了 先待一下');
    setPushText(null);
    setBoard((items) => [
      { id: `me-help-${Date.now()}`, animal: me.animal, name: me.name, text: `做「${task}」卡住了 需要幫忙`, kind: 'help' },
      ...items.filter((item) => !item.id.startsWith('me-')),
    ]);

    setTimeout(() => showPush(`${pick(NAMES)} 推了你一把 👉`, 4), 10000);
    setTimeout(() => showPush(`${pick(NAMES)} 揍了你一下 × 3 👊`, 6), 24000);
  };

  const resumeWorking = () => {
    setAskingHelp(false);
    setNotice('好 回去做');
    setPushText(null);
    setSupportIndex(1);
    setBoard((items) => [
      { id: `me-working-${Date.now()}`, animal: me.animal, name: me.name, text: `正在做「${task}」`, kind: 'working' },
      ...items.filter((item) => !item.id.startsWith('me-')),
    ]);
  };

  const finishTask = () => {
    if (finished) return;
    setFinished(true);
    setAskingHelp(false);
    setPushText(null);
    setNotice('完成啦 已經貼到公告欄 🎉');
    setBoard((items) => [
      { id: `me-done-${Date.now()}`, animal: me.animal, name: me.name, text: `完成了「${task}」 🎉`, kind: 'done' },
      ...items.filter((item) => !item.id.startsWith('me-')),
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable>
          <Text style={styles.brand}>Companion</Text>
          <Pressable onPress={() => setBoardOpen(true)} style={styles.boardButton}><Text style={styles.boardButtonText}>📌 公告欄</Text></Pressable>
        </View>

        <View style={styles.identityPill}><Text style={styles.identityText}>這次你是 {me.name} {me.animal}</Text></View>

        <View style={styles.roomCard}>
          <Text style={styles.roomTitle}>{finished ? '做完啦' : askingHelp ? '卡住中' : '開工中'}</Text>
          <View style={styles.scene}>
            <Text style={styles.wood}>🪵</Text>
            <View style={styles.youSpot}>
              <Text style={styles.mainAnimal}>{me.animal}</Text>
              <Text style={styles.hammer}>{askingHelp ? '🫠' : finished ? '✨' : '🔨'}</Text>
            </View>
            <Text style={styles.box}>📦</Text>
          </View>
          <Text style={styles.taskLabel}>現在在做</Text>
          <Text style={styles.taskTitle}>{task}</Text>
        </View>

        <View style={styles.supportBubble}>
          <Text style={styles.supportAnimal}>{me.animal}</Text>
          <Text style={styles.supportText}>{finished ? '靠 真的做完了欸' : SUPPORT_MESSAGES[supportIndex]}</Text>
        </View>

        {pushText && (
          <Animated.View style={[styles.pushCard, { transform: [{ scale: pushScale }] }]}>
            <Text style={styles.pushBig}>⚡</Text>
            <Text style={styles.pushText}>{pushText}</Text>
          </Animated.View>
        )}

        {notice && <View style={styles.notice}><Text style={styles.noticeText}>{notice}</Text></View>}

        {!finished ? (
          <View style={styles.actionsWrap}>
            {askingHelp ? (
              <Pressable onPress={resumeWorking} style={({ pressed }) => [styles.resumeButton, pressed && styles.pressed]}>
                <Text style={styles.resumeText}>我開始做了</Text>
              </Pressable>
            ) : (
              <Pressable onPress={askForHelp} style={({ pressed }) => [styles.helpButton, pressed && styles.pressed]}>
                <Text style={styles.helpText}>幫我</Text>
              </Pressable>
            )}
            <Pressable onPress={finishTask} style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}>
              <Text style={styles.doneText}>完成任務 ✓</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.actionsWrap}>
            <Pressable onPress={() => setBoardOpen(true)} style={styles.helpButton}><Text style={styles.helpText}>看看公告欄</Text></Pressable>
            <Pressable onPress={() => router.replace('/')} style={styles.doneButton}><Text style={styles.doneText}>再做一件</Text></Pressable>
          </View>
        )}
      </ScrollView>

      <Modal visible={boardOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setBoardOpen(false)}>
        <SafeAreaView style={styles.boardSafeArea}>
          <View style={styles.boardHeader}>
            <Text style={styles.boardTitle}>📌 公告欄</Text>
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
                {item.kind === 'help' && item.name !== me.name && <Pressable style={styles.cheerButton}><Text style={styles.cheerText}>幫他</Text></Pressable>}
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
  boardButton: { padding: 8 },
  boardButtonText: { color: '#765C4D', fontSize: 13, fontWeight: '700' },
  identityPill: { alignSelf: 'center', backgroundColor: '#F2E3D7', borderRadius: 999, marginTop: 16, paddingHorizontal: 14, paddingVertical: 8 },
  identityText: { color: '#765C4D', fontSize: 12, fontWeight: '700' },
  roomCard: { alignItems: 'center', backgroundColor: '#F9E9DB', borderColor: '#E8CEBB', borderRadius: 30, borderWidth: 1, marginTop: 14, padding: 24 },
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
  supportText: { color: '#5F4A3E', flex: 1, fontSize: 16, fontWeight: '700', lineHeight: 23 },
  pushCard: { alignItems: 'center', backgroundColor: '#FFE3B8', borderColor: '#D6944D', borderRadius: 22, borderWidth: 2, marginTop: 14, padding: 20 },
  pushBig: { fontSize: 34 },
  pushText: { color: '#5D3A20', fontSize: 18, fontWeight: '900', marginTop: 6, textAlign: 'center' },
  notice: { alignItems: 'center', backgroundColor: '#F2D9C4', borderRadius: 16, marginTop: 12, padding: 12 },
  noticeText: { color: '#6E432C', fontSize: 13, fontWeight: '700' },
  actionsWrap: { flexDirection: 'row', gap: 12, marginTop: 22 },
  helpButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#D8C1B0', borderRadius: 18, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 58 },
  helpText: { color: '#765C4D', fontSize: 15, fontWeight: '800' },
  resumeButton: { alignItems: 'center', backgroundColor: '#E7F1DF', borderColor: '#A7BF96', borderRadius: 18, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 58 },
  resumeText: { color: '#506445', fontSize: 15, fontWeight: '900' },
  doneButton: { alignItems: 'center', backgroundColor: '#A86F4D', borderRadius: 18, flex: 1.25, justifyContent: 'center', minHeight: 58 },
  doneText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  pressed: { opacity: 0.72 },
  boardSafeArea: { backgroundColor: '#FFF9F1', flex: 1 },
  boardHeader: { alignItems: 'center', borderBottomColor: '#EDDED2', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', padding: 24 },
  boardTitle: { color: '#493D34', fontSize: 24, fontWeight: '800' },
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
