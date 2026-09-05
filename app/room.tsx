import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
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
import { useAuth } from '../lib/auth';
import { useProfile } from '../lib/profile';
import {
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

const TASKS = [
  '打掃房間',
  '寫報告',
  '讀書',
  '工作',
  '運動',
  '做家事',
  '整理東西',
  '其他事項',
] as const;

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

const MAX_PUNCHES_PER_USER = 2;
const MAX_PUNCHERS_PER_HELP_REQUEST = 4;
const HEARTBEAT_MS = 20_000;

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

type CrewCharacterProps = {
  member: CrewMember;
  state?: AnimalAnimationState;
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

function isNpc(member: CrewMember) {
  return member.id.startsWith('npc-');
}

function makeCrewMember(id: string, action: ConstructionActionId, isMe = false): CrewMember {
  return {
    id,
    action,
    animal: pick(ANIMAL_OPTIONS),
    isMe,
    name: pick(NAME_OPTIONS),
  };
}

function makeNpcPool(): CrewMember[] {
  const actions = shuffle(CONSTRUCTION_ACTION_IDS).slice(0, 3);
  return actions.map((action, index) => makeCrewMember(`npc-${index + 1}`, action));
}

function makeBoardItem(member: CrewMember, task: Task, kind: RoomStatus = 'working'): BoardItem {
  const text =
    kind === 'done'
      ? `完成了「${task}」 🎉`
      : kind === 'help'
        ? `做「${task}」卡住了，需要幫忙`
        : `正在做「${task}」`;

  return {
    id: member.id,
    animal: member.animal,
    helper: isNpc(member),
    kind,
    name: member.name,
    text,
  };
}

function makeSessionBoardItem(session: RoomSession): BoardItem {
  const task = isTask(session.task) ? session.task : '其他事項';
  return makeBoardItem(roomSessionToCrewMember(session), task, session.status);
}

function boardKindToAnimationState(kind: RoomStatus): AnimalAnimationState {
  return kind === 'done' ? 'done' : kind === 'help' ? 'idle' : 'working';
}

function CrewCharacter({ member, state = 'working' }: CrewCharacterProps) {
  const isPaused = state === 'idle';
  const stateLabel =
    state === 'done'
      ? '完成了'
      : state === 'idle'
        ? '等待幫忙'
        : state === 'pushed'
          ? '被推了一把'
          : '被揍醒了';

  return (
    <View style={[styles.crewMember, member.isMe && styles.meMember, isPaused && styles.pausedMember]}>
      <View style={styles.characterVisual}>
        <AnimalCharacter animal={member.animal} size={member.isMe ? 'large' : 'regular'} state={state} />
        {state === 'working' && <ConstructionAction action={member.action} emphasized={member.isMe} />}
      </View>
      <Text numberOfLines={1} style={[styles.crewName, member.isMe && styles.meName]}>
        {member.isMe ? `${member.name}（我）` : member.name}
      </Text>
      {isNpc(member) && <Text style={styles.helperTag}>小幫手</Text>}
      {state !== 'working' && <Text style={[styles.stateLabel, isPaused && styles.pausedLabel]}>{stateLabel}</Text>}
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
  const me: CrewMember = {
    id: 'me',
    action: myAction,
    animal: profile?.animal ?? '🐱',
    isMe: true,
    name: profile?.nickname ?? '你',
  };
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
  const helpRequestIdRef = useRef(0);
  const punchersRef = useRef(new Set<string>());
  const roomSessionIdRef = useRef(`room-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);

  const realHelpers = liveSessions.slice(0, 3).map(roomSessionToCrewMember);
  const helpers = [...realHelpers, ...npcPool.slice(0, Math.max(0, 3 - realHelpers.length))];
  const board = [
    makeBoardItem(me, task, status),
    ...liveSessions.map(makeSessionBoardItem),
    ...npcPool.map((member) => makeBoardItem(member, pick(TASKS))),
  ].slice(0, 4);

  const askingHelp = status === 'help';
  const finished = status === 'done';
  const myAnimationState: AnimalAnimationState = finished
    ? 'done'
    : impactState ?? (askingHelp ? 'idle' : 'working');

  const clearSupportTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  useEffect(() => {
    return () => {
      clearSupportTimers();
    };
  }, []);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId || !profile) return;

    let active = true;
    const roomSessionId = roomSessionIdRef.current;

    const refresh = async () => {
      try {
        const sessions = await fetchActiveRoomSessions(userId);
        if (active) setLiveSessions(sessions);
      } catch {
        if (active) setLiveSessions([]);
      }
    };

    const connect = async () => {
      const { error } = await joinRoom({
        id: roomSessionId,
        userId,
        name: me.name,
        animal: me.animal,
        task,
        status,
        action: me.action,
      });

      if (!error) {
        await refresh();
      }
    };

    void connect();

    const channel = subscribeToRoomSessions(() => {
      void refresh();
    });

    const heartbeat = setInterval(() => {
      void heartbeatRoomSession(roomSessionId, userId);
    }, HEARTBEAT_MS);

    return () => {
      active = false;
      clearInterval(heartbeat);
      void leaveRoom(roomSessionId, userId);
      void supabase.removeChannel(channel);
    };
  }, [me.action, me.animal, me.name, profile, session?.user.id, task]);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId || !profile) return;

    void updateRoomSession(roomSessionIdRef.current, userId, { status, task });
  }, [profile, session?.user.id, status, task]);

  const animateSupport = (kind: SupportKind) => {
    supportScale.setValue(0.9);
    setImpactState(kind === 'push' ? 'pushed' : 'punched');

    if (kind === 'push') {
      Vibration.vibrate(90);
    } else {
      Vibration.vibrate([0, 70, 100, 70], false);
    }

    Animated.spring(supportScale, {
      bounciness: 18,
      speed: 23,
      toValue: 1,
      useNativeDriver: true,
    }).start();

    const resetImpactTimer = setTimeout(() => setImpactState(null), 900);
    timersRef.current.push(resetImpactTimer);
  };

  const showSupport = (helper: CrewMember, kind: SupportKind, count = 1) => {
    const limitedCount = Math.min(count, MAX_PUNCHES_PER_USER);

    if (kind === 'punch') {
      if (punchersRef.current.size >= MAX_PUNCHERS_PER_HELP_REQUEST || punchersRef.current.has(helper.id)) {
        return;
      }
      punchersRef.current.add(helper.id);
    }

    setSupportKind(kind);
    setSupportIndex(kind === 'push' ? 4 : 6);
    setSupportText(
      kind === 'push'
        ? `${helper.name} 推你一把 👉`
        : `${helper.name} 揍了你 ${limitedCount} 下 👊`,
    );
    animateSupport(kind);
  };

  const askForHelp = () => {
    if (askingHelp || finished) return;

    clearSupportTimers();
    helpRequestIdRef.current += 1;
    const requestId = helpRequestIdRef.current;
    punchersRef.current = new Set();
    setStatus('help');
    setNotice(
      liveSessions.length > 0
        ? '房間裡的人會看到你卡住了，小幫手也會補位'
        : '已經喊「幫我」了，小幫手正在趕來',
    );
    setSupportText(null);
    setSupportKind(null);
    setImpactState(null);

    const pushTimer = setTimeout(() => {
      if (helpRequestIdRef.current === requestId) {
        showSupport(npcPool[0], 'push');
      }
    }, 10000);

    const punchTimer = setTimeout(() => {
      if (helpRequestIdRef.current === requestId) {
        showSupport(npcPool[1], 'punch', 2);
      }
    }, 24000);

    timersRef.current = [pushTimer, punchTimer];
  };

  const resumeWorking = () => {
    clearSupportTimers();
    helpRequestIdRef.current += 1;
    setStatus('working');
    setNotice('好，大家繼續一起施工');
    setSupportText(null);
    setSupportKind(null);
    setImpactState(null);
    setSupportIndex(1);
  };

  const finishTask = () => {
    if (finished) return;

    clearSupportTimers();
    helpRequestIdRef.current += 1;
    setStatus('done');
    setSupportText(null);
    setSupportKind(null);
    setImpactState(null);
    setNotice('完成啦，已經貼到公告欄 🎉');
  };

  const roomTitle = finished ? '任務完成！' : askingHelp ? '卡住了，等待幫忙' : '大家一起施工';
  const roomSubtitle = askingHelp
    ? '你先停一下，其他人還在動工'
    : finished
      ? '你可以休息了，其他人繼續忙'
      : realHelpers.length > 0
        ? `現在有 ${realHelpers.length} 個真人跟你一起施工`
        : '現在先由小幫手陪你施工';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <Text style={styles.brand}>Companion</Text>
          <Pressable onPress={() => setBoardOpen(true)} style={styles.boardButton}>
            <Text style={styles.boardButtonText}>📌 公告欄</Text>
          </Pressable>
        </View>

        <View style={styles.identityPill}>
          <Text style={styles.identityText}>{me.name}</Text>
          <AnimalCharacter animal={me.animal} size="small" state={myAnimationState} />
        </View>

        <View
          style={[
            styles.roomCard,
            askingHelp && styles.helpRoomCard,
            finished && styles.doneRoomCard,
          ]}>
          <Text style={styles.roomTitle}>{roomTitle}</Text>
          <Text style={styles.roomSubtitle}>{roomSubtitle}</Text>

          <View style={styles.mainSpot}>
            <CrewCharacter member={me} state={myAnimationState} />
          </View>

          <View style={styles.helperRow}>
            {helpers.map((member) => (
              <CrewCharacter key={member.id} member={member} />
            ))}
          </View>

          <Text style={styles.taskLabel}>現在在做</Text>
          <Text style={styles.taskTitle}>{task}</Text>
        </View>

        <View style={styles.supportBubble}>
          <View style={styles.supportAvatar}>
            <AnimalCharacter animal={me.animal} size="small" state={myAnimationState} />
          </View>
          <Text style={styles.supportMessage}>{finished ? '靠，真的做完了欸' : SUPPORT_MESSAGES[supportIndex]}</Text>
        </View>

        {supportText && (
          <Animated.View
            style={[
              styles.supportCard,
              supportKind === 'punch' && styles.punchCard,
              { transform: [{ scale: supportScale }] },
            ]}>
            <Text style={styles.supportBig}>{supportKind === 'punch' ? '👊👊' : '👉'}</Text>
            <Text style={styles.supportText}>{supportText}</Text>
          </Animated.View>
        )}

        {notice && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        )}

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
            <Pressable onPress={() => setBoardOpen(true)} style={styles.helpButton}>
              <Text style={styles.helpText}>看看公告欄</Text>
            </Pressable>
            <Pressable onPress={() => router.replace('/')} style={styles.doneButton}>
              <Text style={styles.doneText}>再做一件</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <Modal
        animationType="slide"
        onRequestClose={() => setBoardOpen(false)}
        presentationStyle="pageSheet"
        visible={boardOpen}>
        <SafeAreaView style={styles.boardSafeArea}>
          <View style={styles.boardHeader}>
            <Text style={styles.boardTitle}>📌 公告欄</Text>
            <Pressable onPress={() => setBoardOpen(false)} style={styles.closeButton}>
              <Text style={styles.closeText}>關閉</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.boardList}>
            {board.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.boardItem,
                  item.kind === 'help' && styles.helpItem,
                  item.kind === 'done' && styles.doneItem,
                ]}>
                <View style={styles.boardAvatar}>
                  <AnimalCharacter
                    animal={item.animal}
                    size="small"
                    state={boardKindToAnimationState(item.kind)}
                  />
                </View>
                <View style={styles.boardCopy}>
                  <View style={styles.nameRow}>
                    <Text style={styles.boardName}>{item.name}</Text>
                    {item.helper ? (
                      <Text style={styles.boardHelperTag}>小幫手</Text>
                    ) : item.id === me.id ? (
                      <Text style={styles.meTag}>我</Text>
                    ) : null}
                  </View>
                  <Text style={styles.boardText}>{item.text}</Text>
                </View>
                {item.kind === 'working' && item.id !== me.id && (
                  <Pressable style={styles.cheerButton}>
                    <Text style={styles.cheerText}>加油</Text>
                  </Pressable>
                )}
                {item.kind === 'done' && <Text style={styles.doneStamp}>🎉</Text>}
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
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  backButton: { alignItems: 'center', height: 42, justifyContent: 'center', width: 42 },
  backText: { color: '#6F5748', fontSize: 36, lineHeight: 38 },
  brand: { color: '#493D34', fontSize: 20, fontWeight: '700' },
  boardButton: { padding: 8 },
  boardButtonText: { color: '#765C4D', fontSize: 13, fontWeight: '700' },
  identityPill: { alignItems: 'center', alignSelf: 'center', backgroundColor: '#F2E3D7', borderRadius: 999, flexDirection: 'row', gap: 5, marginTop: 16, paddingHorizontal: 14, paddingVertical: 6 },
  identityText: { color: '#765C4D', fontSize: 12, fontWeight: '700' },
  roomCard: { alignItems: 'center', backgroundColor: '#F9E9DB', borderColor: '#E8CEBB', borderRadius: 30, borderWidth: 1, marginTop: 14, paddingHorizontal: 16, paddingVertical: 22, shadowColor: '#8D6750', shadowOffset: { height: 8, width: 0 }, shadowOpacity: 0.08, shadowRadius: 16 },
  helpRoomCard: { backgroundColor: '#FFF0E5', borderColor: '#DFAD8D' },
  doneRoomCard: { backgroundColor: '#F3EED9', borderColor: '#D6C68E' },
  roomTitle: { color: '#745646', fontSize: 15, fontWeight: '900', letterSpacing: 0.8 },
  roomSubtitle: { color: '#987C69', fontSize: 12, lineHeight: 18, marginTop: 6, textAlign: 'center' },
  mainSpot: { marginTop: 18 },
  helperRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 12, width: '100%' },
  crewMember: { alignItems: 'center', backgroundColor: '#FFF9F3', borderColor: '#E7D3C4', borderRadius: 18, borderWidth: 1, flex: 1, maxWidth: 108, minHeight: 128, paddingHorizontal: 6, paddingVertical: 10 },
  meMember: { backgroundColor: '#FFFFFF', borderColor: '#CE9F80', borderRadius: 24, flexGrow: 0, maxWidth: 190, minHeight: 152, paddingHorizontal: 24, paddingVertical: 14, width: 180 },
  pausedMember: { backgroundColor: '#FFF7F2', borderColor: '#D9906C', borderStyle: 'dashed' },
  characterVisual: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'center' },
  crewName: { color: '#5D4A3D', fontSize: 11, fontWeight: '800', marginTop: 4, maxWidth: '100%' },
  meName: { fontSize: 14, marginTop: 5 },
  helperTag: { backgroundColor: '#EFE3D8', borderRadius: 7, color: '#896D5B', fontSize: 8, fontWeight: '800', marginTop: 4, overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 2 },
  stateLabel: { color: '#8B7363', fontSize: 10, fontWeight: '700', marginTop: 5 },
  pausedLabel: { color: '#B35F42' },
  taskLabel: { color: '#9A8171', fontSize: 11, marginTop: 20 },
  taskTitle: { color: '#493D34', fontSize: 24, fontWeight: '800', marginTop: 5 },
  supportBubble: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#EDDED2', borderRadius: 22, borderWidth: 1, flexDirection: 'row', marginTop: 18, padding: 18 },
  supportAvatar: { marginRight: 12 },
  supportMessage: { color: '#5F4A3E', flex: 1, fontSize: 16, fontWeight: '700', lineHeight: 23 },
  supportCard: { alignItems: 'center', backgroundColor: '#FFE3B8', borderColor: '#D6944D', borderRadius: 22, borderWidth: 2, marginTop: 14, padding: 20 },
  punchCard: { backgroundColor: '#FFD8CB', borderColor: '#C96B54' },
  supportBig: { fontSize: 34 },
  supportText: { color: '#5D3A20', fontSize: 18, fontWeight: '900', marginTop: 6, textAlign: 'center' },
  notice: { alignItems: 'center', backgroundColor: '#F2D9C4', borderRadius: 16, marginTop: 12, padding: 12 },
  noticeText: { color: '#6E432C', fontSize: 13, fontWeight: '700', textAlign: 'center' },
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
  boardAvatar: { marginRight: 12 },
  boardCopy: { flex: 1 },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  boardName: { color: '#55483E', fontSize: 14, fontWeight: '800' },
  boardHelperTag: { backgroundColor: '#EFE3D8', borderRadius: 8, color: '#8A6D5A', fontSize: 9, overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 2 },
  meTag: { backgroundColor: '#E4EEE0', borderRadius: 8, color: '#57704B', fontSize: 9, overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 2 },
  boardText: { color: '#806E62', fontSize: 12, lineHeight: 18, marginTop: 3 },
  cheerButton: { backgroundColor: '#F2E3D7', borderRadius: 12, marginLeft: 8, paddingHorizontal: 11, paddingVertical: 8 },
  cheerText: { color: '#805E49', fontSize: 12, fontWeight: '800' },
  doneStamp: { fontSize: 22, marginLeft: 8 },
});
