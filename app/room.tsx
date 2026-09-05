import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimalCharacter } from '../components/AnimalCharacter';
import { ConstructionAction } from '../components/ConstructionAction';
import { ANIMAL_OPTIONS, CONSTRUCTION_ACTION_IDS, NAME_OPTIONS } from '../constants/crew';
import { recordTaskCompletion } from '../lib/activity';
import { useAuth } from '../lib/auth';
import { useProfile } from '../lib/profile';
import {
  assignRoom,
  fetchActiveRoomSessions,
  heartbeatRoomSession,
  joinRoom,
  leaveRoom,
  roomSessionToCrewMember,
  subscribeToRoomSessions,
  updateRoomSession,
  type RoomSession,
  type RoomStatus,
} from '../lib/room-realtime';
import { supabase } from '../lib/supabase';
import type { AnimalAnimationState, ConstructionActionId, CrewMember } from '../types/crew';

const TASKS = ['打掃房間', '寫報告', '讀書', '工作', '運動', '做家事', '整理東西', '其他事項'] as const;
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

const ROOM_CAPACITY = 6;
const HEARTBEAT_MS = 20_000;
const COMPLETE_EXIT_MS = 3500;

type Task = (typeof TASKS)[number];
type SupportKind = 'push' | 'punch';

type BoardItem = {
  id: string;
  animal: string;
  name: string;
  text: string;
  kind: RoomStatus;
  helper: boolean;
};

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy;
}

function isTask(value: unknown): value is Task {
  return typeof value === 'string' && TASKS.some((task) => task === value);
}

function makeNpcPool(): CrewMember[] {
  const actions = shuffle(CONSTRUCTION_ACTION_IDS);
  return Array.from({ length: ROOM_CAPACITY - 1 }, (_, index) => ({
    id: `npc-${index + 1}`,
    animal: pick(ANIMAL_OPTIONS),
    name: pick(NAME_OPTIONS),
    action: actions[index % actions.length],
    isMe: false,
    isNpc: true,
  }));
}

function makeBoardItem(member: CrewMember, task: Task, kind: RoomStatus = 'working'): BoardItem {
  const text = kind === 'done'
    ? `完成了「${task}」 🎉`
    : kind === 'help'
      ? `做「${task}」卡住了，需要幫忙`
      : `正在做「${task}」`;
  return { id: member.id, animal: member.animal, name: member.name, text, kind, helper: Boolean(member.isNpc) };
}

function makeSessionBoardItem(session: RoomSession): BoardItem {
  return makeBoardItem(roomSessionToCrewMember(session), isTask(session.task) ? session.task : '其他事項', session.status);
}

function boardState(kind: RoomStatus): AnimalAnimationState {
  return kind === 'done' ? 'done' : kind === 'help' ? 'idle' : 'working';
}

function CrewCharacter({ member, state = 'working' }: { member: CrewMember; state?: AnimalAnimationState }) {
  return (
    <View style={[styles.crewMember, member.isMe && styles.meMember, state === 'idle' && styles.pausedMember]}>
      <View style={styles.characterVisual}>
        <AnimalCharacter animal={member.animal} size={member.isMe ? 'large' : 'regular'} state={state} />
        {state === 'working' && <ConstructionAction action={member.action} emphasized={member.isMe} />}
      </View>
      <Text numberOfLines={1} style={[styles.crewName, member.isMe && styles.meName]}>
        {member.isMe ? `${member.name}（我）` : member.name}
      </Text>
      {member.isNpc && <Text style={styles.helperTag}>小幫手</Text>}
    </View>
  );
}

export default function RoomScreen() {
  const { session } = useAuth();
  const { profile } = useProfile();
  const params = useLocalSearchParams<{ task?: string }>();
  const task: Task = isTask(params.task) ? params.task : '其他事項';
  const [myAction] = useState<ConstructionActionId>(() => pick(CONSTRUCTION_ACTION_IDS));
  const [npcPool] = useState(makeNpcPool);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [liveSessions, setLiveSessions] = useState<RoomSession[]>([]);
  const [status, setStatus] = useState<RoomStatus>('working');
  const [boardOpen, setBoardOpen] = useState(false);
  const [supportIndex, setSupportIndex] = useState(() => Math.floor(Math.random() * SUPPORT_MESSAGES.length));
  const [notice, setNotice] = useState<string | null>(null);
  const [supportText, setSupportText] = useState<string | null>(null);
  const [supportKind, setSupportKind] = useState<SupportKind | null>(null);
  const [impactState, setImpactState] = useState<'pushed' | 'punched' | null>(null);
  const [supportScale] = useState(() => new Animated.Value(0.92));
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const roomSessionIdRef = useRef(`room-session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);

  const me = useMemo<CrewMember>(() => ({
    id: 'me',
    action: myAction,
    animal: profile?.animal ?? '🐱',
    isMe: true,
    name: profile?.nickname ?? '你',
  }), [myAction, profile?.animal, profile?.nickname]);

  const realHelpers = liveSessions.slice(0, ROOM_CAPACITY - 1).map(roomSessionToCrewMember);
  const helpers = [...realHelpers, ...npcPool.slice(0, Math.max(0, ROOM_CAPACITY - 1 - realHelpers.length))];
  const askingHelp = status === 'help';
  const finished = status === 'done';
  const myAnimationState: AnimalAnimationState = finished ? 'done' : impactState ?? (askingHelp ? 'idle' : 'working');
  const board = [makeBoardItem(me, task, status), ...liveSessions.map(makeSessionBoardItem)].slice(0, ROOM_CAPACITY);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  useEffect(() => () => clearTimers(), []);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId || !profile) return;
    let active = true;

    void assignRoom(ROOM_CAPACITY)
      .then((assignedRoomId) => {
        if (active) setRoomId(assignedRoomId);
      })
      .catch((error: unknown) => {
        if (active) setRoomError(error instanceof Error ? error.message : '加入房間失敗');
      });

    return () => {
      active = false;
    };
  }, [profile, session?.user.id]);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId || !profile || !roomId) return;

    let active = true;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let channel: ReturnType<typeof subscribeToRoomSessions> | null = null;
    const roomSessionId = roomSessionIdRef.current;

    const refresh = async () => {
      try {
        const sessions = await fetchActiveRoomSessions(userId, roomId);
        if (active) setLiveSessions(sessions);
      } catch {
        if (active) setLiveSessions([]);
      }
    };

    const connect = async () => {
      const { error } = await joinRoom({
        id: roomSessionId,
        roomId,
        userId,
        name: me.name,
        animal: me.animal,
        task,
        status: 'working',
        action: me.action,
      });
      if (error || !active) return;

      await refresh();
      channel = subscribeToRoomSessions(roomId, () => void refresh());
      heartbeat = setInterval(() => void heartbeatRoomSession(roomSessionId, userId), HEARTBEAT_MS);
    };

    void connect();

    return () => {
      active = false;
      if (heartbeat) clearInterval(heartbeat);
      if (channel) void supabase.removeChannel(channel);
      void leaveRoom(roomSessionId, userId);
    };
  }, [me.action, me.animal, me.name, profile, roomId, session?.user.id, task]);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId || !roomId) return;
    void updateRoomSession(roomSessionIdRef.current, userId, { status, task });
  }, [roomId, session?.user.id, status, task]);

  const animateSupport = (kind: SupportKind) => {
    supportScale.setValue(0.9);
    setImpactState(kind === 'push' ? 'pushed' : 'punched');
    Vibration.vibrate(kind === 'push' ? 90 : [0, 70, 100, 70]);
    Animated.spring(supportScale, { bounciness: 18, speed: 23, toValue: 1, useNativeDriver: true }).start();
    const reset = setTimeout(() => setImpactState(null), 900);
    timersRef.current.push(reset);
  };

  const askForHelp = () => {
    if (askingHelp || finished) return;
    clearTimers();
    setStatus('help');
    setNotice('已經喊幫我了 房間裡的人會看到');
    setSupportText(null);

    const pushTimer = setTimeout(() => {
      const helper = helpers[0] ?? npcPool[0];
      setSupportKind('push');
      setSupportText(`${helper.name} 推你一把 👉`);
      setSupportIndex(4);
      animateSupport('push');
    }, 10000);
    timersRef.current.push(pushTimer);
  };

  const resumeWorking = () => {
    clearTimers();
    setStatus('working');
    setNotice('好 大家繼續一起施工');
    setSupportText(null);
    setSupportKind(null);
    setImpactState(null);
    setSupportIndex(1);
  };

  const finishTask = () => {
    const userId = session?.user.id;
    if (finished || !userId) return;

    clearTimers();
    setStatus('done');
    setSupportText(null);
    setSupportKind(null);
    setNotice('完成啦 大家幫你慶祝一下 🎉');
    void recordTaskCompletion(userId, task);

    const exitTimer = setTimeout(async () => {
      await leaveRoom(roomSessionIdRef.current, userId);
      router.replace('/');
    }, COMPLETE_EXIT_MS);
    timersRef.current.push(exitTimer);
  };

  if (!roomId && !roomError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#A86F4D" size="large" />
          <Text style={styles.loadingText}>正在幫你找施工房...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (roomError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <Text style={styles.errorText}>{roomError}</Text>
          <Pressable onPress={() => router.replace('/')} style={styles.doneButton}>
            <Text style={styles.doneText}>回首頁</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const roomLabel = roomId ? `施工房 ${roomId.slice(0, 4).toUpperCase()}` : '施工房';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.brand}>Companion</Text>
            <Text style={styles.roomCode}>{roomLabel} · {Math.min(ROOM_CAPACITY, realHelpers.length + 1)}/{ROOM_CAPACITY} 真人</Text>
          </View>
          <Pressable onPress={() => setBoardOpen(true)} style={styles.boardButton}><Text style={styles.boardButtonText}>📌</Text></Pressable>
        </View>

        <View style={[styles.roomCard, askingHelp && styles.helpRoomCard, finished && styles.doneRoomCard]}>
          <Text style={styles.roomTitle}>{finished ? '任務完成！' : askingHelp ? '卡住了 等人來推你' : '大家一起施工'}</Text>
          <Text style={styles.roomSubtitle}>{realHelpers.length > 0 ? `有 ${realHelpers.length} 個真人跟你同房` : '現在先由小幫手補位'}</Text>
          <View style={styles.mainSpot}><CrewCharacter member={me} state={myAnimationState} /></View>
          <View style={styles.helperGrid}>
            {helpers.map((member) => <CrewCharacter key={member.id} member={member} />)}
          </View>
          <Text style={styles.taskLabel}>現在在做</Text>
          <Text style={styles.taskTitle}>{task}</Text>
        </View>

        <View style={styles.supportBubble}>
          <AnimalCharacter animal={me.animal} size="small" state={myAnimationState} />
          <Text style={styles.supportMessage}>{finished ? '靠 真的做完了欸' : SUPPORT_MESSAGES[supportIndex]}</Text>
        </View>

        {supportText && (
          <Animated.View style={[styles.supportCard, supportKind === 'punch' && styles.punchCard, { transform: [{ scale: supportScale }] }]}>
            <Text style={styles.supportText}>{supportText}</Text>
          </Animated.View>
        )}
        {notice && <View style={styles.notice}><Text style={styles.noticeText}>{notice}</Text></View>}

        {!finished ? (
          <View style={styles.actionsWrap}>
            <Pressable onPress={askingHelp ? resumeWorking : askForHelp} style={askingHelp ? styles.resumeButton : styles.helpButton}>
              <Text style={askingHelp ? styles.resumeText : styles.helpText}>{askingHelp ? '我開始做了' : '幫我'}</Text>
            </Pressable>
            <Pressable onPress={finishTask} style={styles.doneButton}><Text style={styles.doneText}>完成任務 ✓</Text></Pressable>
          </View>
        ) : (
          <Text style={styles.exitHint}>慶祝一下 你等等會自動退出房間</Text>
        )}
      </ScrollView>

      <Modal animationType="slide" onRequestClose={() => setBoardOpen(false)} presentationStyle="pageSheet" visible={boardOpen}>
        <SafeAreaView style={styles.boardSafeArea}>
          <View style={styles.boardHeader}>
            <View><Text style={styles.boardTitle}>📌 房間公告欄</Text><Text style={styles.boardSubtitle}>{roomLabel}</Text></View>
            <Pressable onPress={() => setBoardOpen(false)} style={styles.closeButton}><Text style={styles.closeText}>關閉</Text></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.boardList}>
            {board.map((item) => (
              <View key={item.id} style={[styles.boardItem, item.kind === 'help' && styles.helpItem, item.kind === 'done' && styles.doneItem]}>
                <AnimalCharacter animal={item.animal} size="small" state={boardState(item.kind)} />
                <View style={styles.boardCopy}>
                  <View style={styles.nameRow}>
                    <Text style={styles.boardName}>{item.name}</Text>
                    {item.helper && <Text style={styles.boardHelperTag}>小幫手</Text>}
                  </View>
                  <Text style={styles.boardText}>{item.text}</Text>
                </View>
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
  content: { paddingBottom: 36, paddingHorizontal: 20, paddingTop: 14 },
  loadingWrap: { alignItems: 'center', flex: 1, gap: 14, justifyContent: 'center', padding: 30 },
  loadingText: { color: '#765C4D', fontSize: 15, fontWeight: '700' },
  errorText: { color: '#A04F3B', fontSize: 14, textAlign: 'center' },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  headerCenter: { alignItems: 'center' },
  backButton: { alignItems: 'center', height: 42, justifyContent: 'center', width: 42 },
  backText: { color: '#6F5748', fontSize: 36, lineHeight: 38 },
  brand: { color: '#493D34', fontSize: 20, fontWeight: '700' },
  roomCode: { color: '#9A8171', fontSize: 10, marginTop: 3 },
  boardButton: { alignItems: 'center', height: 42, justifyContent: 'center', width: 42 },
  boardButtonText: { fontSize: 20 },
  roomCard: { alignItems: 'center', backgroundColor: '#F9E9DB', borderColor: '#E8CEBB', borderRadius: 30, borderWidth: 1, marginTop: 16, padding: 18 },
  helpRoomCard: { backgroundColor: '#FFF0E5', borderColor: '#DFAD8D' },
  doneRoomCard: { backgroundColor: '#F3EED9', borderColor: '#D6C68E' },
  roomTitle: { color: '#745646', fontSize: 16, fontWeight: '900' },
  roomSubtitle: { color: '#987C69', fontSize: 12, marginTop: 6 },
  mainSpot: { marginTop: 16 },
  helperGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 12, width: '100%' },
  crewMember: { alignItems: 'center', backgroundColor: '#FFF9F3', borderColor: '#E7D3C4', borderRadius: 18, borderWidth: 1, minHeight: 105, paddingHorizontal: 7, paddingVertical: 9, width: '30%' },
  meMember: { backgroundColor: '#FFFFFF', borderColor: '#CE9F80', minHeight: 145, width: 170 },
  pausedMember: { borderColor: '#D9906C', borderStyle: 'dashed' },
  characterVisual: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'center' },
  crewName: { color: '#5D4A3D', fontSize: 10, fontWeight: '800', marginTop: 3 },
  meName: { fontSize: 14 },
  helperTag: { backgroundColor: '#EFE3D8', borderRadius: 7, color: '#896D5B', fontSize: 8, marginTop: 3, overflow: 'hidden', paddingHorizontal: 5, paddingVertical: 2 },
  taskLabel: { color: '#9A8171', fontSize: 11, marginTop: 18 },
  taskTitle: { color: '#493D34', fontSize: 23, fontWeight: '800', marginTop: 4 },
  supportBubble: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#EDDED2', borderRadius: 22, borderWidth: 1, flexDirection: 'row', gap: 10, marginTop: 16, padding: 16 },
  supportMessage: { color: '#5F4A3E', flex: 1, fontSize: 15, fontWeight: '700', lineHeight: 22 },
  supportCard: { backgroundColor: '#FFE3B8', borderColor: '#D6944D', borderRadius: 20, borderWidth: 2, marginTop: 12, padding: 16 },
  punchCard: { backgroundColor: '#FFD8CB', borderColor: '#C96B54' },
  supportText: { color: '#5D3A20', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  notice: { alignItems: 'center', backgroundColor: '#F2D9C4', borderRadius: 16, marginTop: 12, padding: 12 },
  noticeText: { color: '#6E432C', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  actionsWrap: { flexDirection: 'row', gap: 12, marginTop: 20 },
  helpButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#D8C1B0', borderRadius: 18, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 58 },
  helpText: { color: '#765C4D', fontSize: 15, fontWeight: '800' },
  resumeButton: { alignItems: 'center', backgroundColor: '#E7F1DF', borderColor: '#A7BF96', borderRadius: 18, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 58 },
  resumeText: { color: '#506445', fontSize: 15, fontWeight: '900' },
  doneButton: { alignItems: 'center', alignSelf: 'stretch', backgroundColor: '#A86F4D', borderRadius: 18, flex: 1.25, justifyContent: 'center', minHeight: 58, paddingHorizontal: 18 },
  doneText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  exitHint: { color: '#7C6A5E', fontSize: 13, fontWeight: '700', marginTop: 20, textAlign: 'center' },
  boardSafeArea: { backgroundColor: '#FFF9F1', flex: 1 },
  boardHeader: { alignItems: 'center', borderBottomColor: '#EDDED2', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', padding: 24 },
  boardTitle: { color: '#493D34', fontSize: 23, fontWeight: '800' },
  boardSubtitle: { color: '#9A8171', fontSize: 11, marginTop: 4 },
  closeButton: { backgroundColor: '#F2E3D7', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 9 },
  closeText: { color: '#765C4D', fontSize: 13, fontWeight: '700' },
  boardList: { gap: 10, padding: 20 },
  boardItem: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#EDDED2', borderRadius: 20, borderWidth: 1, flexDirection: 'row', gap: 11, padding: 15 },
  helpItem: { backgroundColor: '#FFF0E8', borderColor: '#E3B99E' },
  doneItem: { backgroundColor: '#FFF8E7' },
  boardCopy: { flex: 1 },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  boardName: { color: '#55483E', fontSize: 14, fontWeight: '800' },
  boardHelperTag: { backgroundColor: '#EFE3D8', borderRadius: 8, color: '#8A6D5A', fontSize: 9, overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 2 },
  boardText: { color: '#806E62', fontSize: 12, marginTop: 3 },
});
