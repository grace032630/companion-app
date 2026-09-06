import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ImageBackground, PanResponder, StyleSheet, Text, View } from 'react-native';

import type { AnimalAnimationState, CrewMember } from '../types/crew';
import { AnimalCharacter } from './AnimalCharacter';
import { ConstructionAction } from './ConstructionAction';

type RoomSceneProps = {
  me: CrewMember;
  helpers: CrewMember[];
  myState: AnimalAnimationState;
  task: string;
  quote?: string | null;
  askingHelp?: boolean;
  finished?: boolean;
};

const SPOTS = [
  { left: '-2%', top: 215 },
  { left: '63%', top: 215 },
  { left: '8%', top: 355 },
  { left: '57%', top: 355 },
  { left: '31%', top: 430 },
] as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function Worker({
  member,
  state = 'working',
  spot,
  delay = 0,
  forceHelp = false,
  quote,
}: {
  member: CrewMember;
  state?: AnimalAnimationState;
  spot: { left: `${number}%`; top: number };
  delay?: number;
  forceHelp?: boolean;
  quote?: string | null;
}) {
  const [walk] = useState(() => new Animated.Value(0));
  const drag = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const dragCurrent = useRef({ x: 0, y: 0 });
  const dragStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const shouldAutoMove = state === 'working' || forceHelp;

    if (!shouldAutoMove) {
      walk.stopAnimation();
      walk.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(walk, {
          duration: 1200 + delay / 2,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(walk, {
          duration: 1200 + delay / 2,
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [delay, forceHelp, state, walk]);

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => Boolean(member.isMe),
      onMoveShouldSetPanResponder: (_, gesture) => Boolean(member.isMe && (Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3)),
      onPanResponderGrant: () => {
        dragStart.current = { ...dragCurrent.current };
      },
      onPanResponderMove: (_, gesture) => {
        if (!member.isMe) return;
        const x = clamp(dragStart.current.x + gesture.dx, -145, 95);
        const y = clamp(dragStart.current.y + gesture.dy, -25, 205);
        drag.setValue({ x, y });
      },
      onPanResponderRelease: (_, gesture) => {
        if (!member.isMe) return;
        const x = clamp(dragStart.current.x + gesture.dx, -145, 95);
        const y = clamp(dragStart.current.y + gesture.dy, -25, 205);
        dragCurrent.current = { x, y };
        Animated.spring(drag, {
          toValue: { x, y },
          bounciness: 5,
          speed: 18,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(drag, {
          toValue: dragCurrent.current,
          bounciness: 5,
          speed: 18,
          useNativeDriver: true,
        }).start();
      },
    }),
    [drag, member.isMe],
  );

  const driftX = walk.interpolate({ inputRange: [0, 1], outputRange: [-5, 6] });
  const autoAndDragX = Animated.add(drag.x, driftX);

  return (
    <Animated.View
      {...(member.isMe ? panResponder.panHandlers : {})}
      style={[
        styles.worker,
        member.isMe && styles.draggableWorker,
        {
          left: spot.left,
          top: spot.top,
          transform: [
            { translateX: autoAndDragX },
            { translateY: drag.y },
          ],
        },
      ]}
    >
      {member.isMe && quote ? (
        <View pointerEvents="none" style={styles.followQuoteBubble}>
          <Text numberOfLines={3} style={styles.followQuoteText}>{quote}</Text>
        </View>
      ) : null}
      <View style={styles.workerBubbleRow}>
        <AnimalCharacter
          animal={member.animal}
          scaleMultiplier={1.5}
          size="regular"
          state={forceHelp ? 'idle' : state}
        />
        {state === 'working' && <ConstructionAction action={member.action} emphasized={member.isMe} />}
      </View>
      <View style={[styles.namePill, member.isMe && styles.meNamePill]}>
        <Text numberOfLines={1} style={styles.nameText}>{member.isMe ? `${member.name} · 我` : member.name}</Text>
        {member.isNpc && <Text style={styles.npcTag}>小幫手</Text>}
      </View>
      {state === 'idle' && <Text style={styles.reaction}>🥺</Text>}
      {state === 'done' && <Text style={styles.reaction}>🎉</Text>}
    </Animated.View>
  );
}

export function RoomScene({ me, helpers, myState, task, quote, askingHelp = false, finished = false }: RoomSceneProps) {
  return (
    <ImageBackground
      source={require('../assets/backgrounds/room-day.png')}
      resizeMode="stretch"
      style={[styles.scene, askingHelp && styles.sceneHelp, finished && styles.sceneDone]}
    >
      <View style={styles.sceneShade} />

      <View style={styles.sceneTitlePill}>
        <Text style={styles.sceneTitle}>{finished ? '施工完成 ✨' : askingHelp ? '先卡一下 會有人來' : '大家正在施工'}</Text>
        <Text style={styles.sceneTask}>{task}</Text>
      </View>

      <Worker member={me} state={myState} spot={{ left: '30%', top: 275 }} delay={120} forceHelp={askingHelp} quote={quote} />
      {helpers.slice(0, 5).map((member, index) => (
        <Worker key={member.id} member={member} spot={SPOTS[index]} delay={index * 170 + 80} />
      ))}

      {askingHelp && <View style={styles.helpSign}><Text style={styles.helpSignText}>！</Text></View>}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  scene: {
    aspectRatio: 896 / 1600,
    backgroundColor: '#EEDCCB',
    borderRadius: 28,
    marginTop: 16,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  sceneShade: { backgroundColor: 'rgba(53,35,23,0.04)', bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  sceneHelp: { borderColor: '#E19B78', borderWidth: 2 },
  sceneDone: { borderColor: '#E2C66A', borderWidth: 2 },
  windowFrame: { backgroundColor: '#D9BFA9', borderColor: '#A98870', borderRadius: 20, borderWidth: 6, height: 150, left: 22, overflow: 'hidden', position: 'absolute', right: 22, top: 22 },
  sky: { flex: 1, overflow: 'hidden', position: 'relative' },
  daySky: { backgroundColor: '#BFE1F4' },
  nightSky: { backgroundColor: '#263248' },
  sun: { fontSize: 29, position: 'absolute', right: 23, top: 15 },
  moon: { color: '#FFF1BA', fontSize: 34, position: 'absolute', right: 28, top: 12 },
  starA: { color: '#FFF2B8', fontSize: 18, left: 36, position: 'absolute', top: 18 },
  starB: { color: '#FFF2B8', fontSize: 26, left: 94, position: 'absolute', top: 35 },
  skyline: { alignItems: 'flex-end', bottom: 0, flexDirection: 'row', gap: 3, left: 0, position: 'absolute', right: 0 },
  building: { backgroundColor: '#49566B', flex: 1, minHeight: 24, position: 'relative' },
  litWindow: { backgroundColor: '#FFD97B', height: 5, left: 4, position: 'absolute', top: 7, width: 4 },
  windowBarV: { backgroundColor: '#A98870', bottom: 0, left: '49%', position: 'absolute', top: 0, width: 5 },
  windowBarH: { backgroundColor: '#A98870', height: 5, left: 0, position: 'absolute', right: 0, top: '53%' },
  curtainLeft: { backgroundColor: '#EAD4C4', borderBottomRightRadius: 22, bottom: 0, left: 0, opacity: 0.9, position: 'absolute', top: 0, width: 28 },
  curtainRight: { backgroundColor: '#EAD4C4', borderBottomLeftRadius: 22, bottom: 0, opacity: 0.9, position: 'absolute', right: 0, top: 0, width: 28 },
  wallPanelA: { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 40, height: 120, left: -30, position: 'absolute', top: 165, width: 150 },
  wallPanelB: { backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 55, height: 150, position: 'absolute', right: -35, top: 150, width: 180 },
  wallShelf: { backgroundColor: '#A97655', borderRadius: 8, left: 30, paddingHorizontal: 11, paddingVertical: 5, position: 'absolute', top: 187 },
  shelfItems: { fontSize: 17 },
  sideTable: { height: 62, position: 'absolute', right: 28, top: 200, width: 64 },
  tableTop: { backgroundColor: '#9E6E4F', borderRadius: 8, height: 12, left: 0, position: 'absolute', right: 0, top: 0 },
  tableLeg: { backgroundColor: '#855B43', borderRadius: 4, height: 52, left: 28, position: 'absolute', top: 9, width: 8 },
  floorLamp: { height: 118, position: 'absolute', right: 26, top: 104, width: 62 },
  lampShade: { backgroundColor: '#F4C98B', borderRadius: 18, height: 34, left: 7, position: 'absolute', top: 0, width: 48 },
  lampPole: { backgroundColor: '#8A6652', height: 72, left: 29, position: 'absolute', top: 31, width: 5 },
  lampBase: { backgroundColor: '#8A6652', borderRadius: 10, bottom: 0, height: 9, left: 17, position: 'absolute', width: 30 },
  plantPot: { left: 18, position: 'absolute', top: 246 },
  plantEmoji: { fontSize: 34 },
  floor: { backgroundColor: '#B27F5F', bottom: 0, height: 250, left: 0, opacity: 0.95, position: 'absolute', right: 0 },
  floorLineA: { backgroundColor: 'rgba(104,69,48,0.17)', bottom: 62, height: 2, left: 0, position: 'absolute', right: 0, transform: [{ rotate: '-5deg' }] },
  floorLineB: { backgroundColor: 'rgba(104,69,48,0.14)', bottom: 132, height: 2, left: 0, position: 'absolute', right: 0, transform: [{ rotate: '4deg' }] },
  floorLineC: { backgroundColor: 'rgba(104,69,48,0.12)', bottom: 202, height: 2, left: 0, position: 'absolute', right: 0 },
  rug: { backgroundColor: '#E1C6AE', borderRadius: 120, bottom: 30, height: 150, left: '10%', opacity: 0.9, position: 'absolute', width: '80%' },
  planks: { bottom: 20, position: 'absolute', right: 18 },
  plankText: { fontSize: 23 },
  sceneTitlePill: { alignItems: 'center', backgroundColor: 'rgba(255,249,243,0.91)', borderRadius: 16, left: '27%', paddingHorizontal: 13, paddingVertical: 7, position: 'absolute', top: 177, width: '46%' },
  sceneTitle: { color: '#6B5142', fontSize: 11, fontWeight: '900' },
  sceneTask: { color: '#917465', fontSize: 9, marginTop: 2 },
  worker: { alignItems: 'center', position: 'absolute', width: 150 },
  draggableWorker: { zIndex: 20 },
  workerBubbleRow: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'center' },
  namePill: { alignItems: 'center', backgroundColor: 'rgba(255,250,246,0.92)', borderRadius: 10, marginTop: 1, maxWidth: 84, paddingHorizontal: 6, paddingVertical: 3 },
  meNamePill: { backgroundColor: '#FFF6E8' },
  nameText: { color: '#5F4A3E', fontSize: 9, fontWeight: '800' },
  npcTag: { color: '#947B6D', fontSize: 6, marginTop: 1 },
  reaction: { fontSize: 18, position: 'absolute', right: -1, top: -10 },
  followQuoteBubble: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E8D8CB',
    borderRadius: 14,
    borderWidth: 1,
    bottom: '100%',
    left: '50%',
    marginBottom: 6,
    maxWidth: 170,
    minWidth: 90,
    paddingHorizontal: 10,
    paddingVertical: 7,
    position: 'absolute',
    transform: [{ translateX: -45 }],
    zIndex: 30,
  },
  followQuoteText: { color: '#6B5548', fontSize: 10, lineHeight: 14, textAlign: 'center' },
  helpSign: { alignItems: 'center', backgroundColor: '#FFCFB8', borderRadius: 15, height: 30, justifyContent: 'center', left: '47%', position: 'absolute', top: 244, width: 30 },
  helpSignText: { color: '#8B4B34', fontSize: 18, fontWeight: '900' },
});
