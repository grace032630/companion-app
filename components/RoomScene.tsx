import { useEffect, useMemo, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import type { AnimalAnimationState, CrewMember } from '../types/crew';
import { isGrayCat } from '../constants/crew';
import { AnimalCharacter } from './AnimalCharacter';
import { GrayCatActor, type GrayCatActorState } from './actors/GrayCatActor';
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
  { left: '5%', top: 188 },
  { left: '68%', top: 186 },
  { left: '20%', top: 280 },
  { left: '58%', top: 282 },
  { left: '38%', top: 345 },
] as const;

// Temporarily switch this to true while calibrating the gray cat base pose.
const SHOW_GRAY_CAT_DEBUG = false;

function grayCatState(state: AnimalAnimationState): GrayCatActorState {
  return state === 'punched' ? 'hit' : state;
}

function Worker({ member, state = 'working', spot, delay = 0 }: { member: CrewMember; state?: AnimalAnimationState; spot: { left: `${number}%`; top: number }; delay?: number }) {
  const [walk] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (state !== 'working' || isGrayCat(member.animal)) {
      walk.stopAnimation();
      walk.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(walk, { duration: 950 + delay / 2, toValue: 1, useNativeDriver: true }),
        Animated.timing(walk, { duration: 950 + delay / 2, toValue: 0, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [delay, member.animal, state, walk]);

  const driftX = walk.interpolate({ inputRange: [0, 1], outputRange: [-2, 3] });

  return (
    <Animated.View style={[styles.worker, { left: spot.left, top: spot.top, transform: [{ translateX: driftX }] }]}>
      <View style={styles.workerBubbleRow}>
        {isGrayCat(member.animal)
          ? <GrayCatActor showDebug={SHOW_GRAY_CAT_DEBUG} size={member.isMe ? 78 : 58} state={grayCatState(state)} />
          : <AnimalCharacter animal={member.animal} size={member.isMe ? 'large' : 'regular'} state={state} />}
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
  const hour = new Date().getHours();
  const isNight = hour < 6 || hour >= 18;
  const [glow] = useState(() => new Animated.Value(0.35));
  const [curtain] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const glowAnim = Animated.loop(Animated.sequence([
      Animated.timing(glow, { duration: 1700, toValue: 0.8, useNativeDriver: true }),
      Animated.timing(glow, { duration: 1700, toValue: 0.35, useNativeDriver: true }),
    ]));
    const curtainAnim = Animated.loop(Animated.sequence([
      Animated.timing(curtain, { duration: 2300, toValue: 1, useNativeDriver: true }),
      Animated.timing(curtain, { duration: 2300, toValue: 0, useNativeDriver: true }),
    ]));
    glowAnim.start(); curtainAnim.start();
    return () => { glowAnim.stop(); curtainAnim.stop(); };
  }, [curtain, glow]);

  const skyline = useMemo(() => Array.from({ length: 13 }, (_, i) => ({ h: 25 + ((i * 17) % 48), lit: i % 3 !== 0 })), []);
  const curtainX = curtain.interpolate({ inputRange: [0, 1], outputRange: [-2, 3] });

  return (
    <View style={[styles.scene, isNight ? styles.sceneNight : styles.sceneDay, askingHelp && styles.sceneHelp, finished && styles.sceneDone]}>
      <View style={styles.windowFrame}>
        <View style={[styles.sky, isNight ? styles.nightSky : styles.daySky]}>
          {isNight ? <><Text style={styles.moon}>☾</Text><Animated.Text style={[styles.starA, { opacity: glow }]}>✦</Animated.Text><Animated.Text style={[styles.starB, { opacity: glow }]}>·</Animated.Text></> : <Text style={styles.sun}>☀</Text>}
          <View style={styles.skyline}>{skyline.map((b, i) => <View key={i} style={[styles.building, { height: b.h }]}>{isNight && b.lit && <View style={styles.litWindow} />}</View>)}</View>
        </View>
        <View style={styles.windowBarV} /><View style={styles.windowBarH} />
        <Animated.View style={[styles.curtainLeft, { transform: [{ translateX: curtainX }] }]} />
        <Animated.View style={[styles.curtainRight, { transform: [{ translateX: Animated.multiply(curtainX, -1) }] }]} />
      </View>

      <View style={styles.wallShelf}><Text style={styles.shelfItems}>📚  🪴</Text></View>
      <View style={styles.lamp}><Text style={styles.lampText}>💡</Text></View>
      <View style={styles.floor} />
      <View style={styles.rug} />
      <View style={styles.workbench}><Text style={styles.workbenchText}>🧰  🪛  📦</Text></View>
      <View style={styles.planks}><Text style={styles.plankText}>🪵 🪵</Text></View>

      <View style={styles.sceneTitlePill}><Text style={styles.sceneTitle}>{finished ? '施工完成 ✨' : askingHelp ? '先卡一下 會有人來' : '大家正在施工'}</Text><Text style={styles.sceneTask}>{task}</Text></View>

      <Worker member={me} state={myState} spot={{ left: '40%', top: 205 }} delay={120} />
      {helpers.slice(0, 5).map((member, index) => <Worker key={member.id} member={member} spot={SPOTS[index]} delay={index * 170 + 80} />)}

      {quote ? <View style={styles.quoteBubble}><Text style={styles.quoteText}>{quote}</Text></View> : null}
      {askingHelp && <View style={styles.helpSign}><Text style={styles.helpSignText}>！</Text></View>}
    </View>
  );
}

const styles = StyleSheet.create({
  scene: { borderRadius: 28, height: 490, marginTop: 16, overflow: 'hidden', position: 'relative' },
  sceneDay: { backgroundColor: '#F7E8D8' }, sceneNight: { backgroundColor: '#3F4559' }, sceneHelp: { borderColor: '#E19B78', borderWidth: 2 }, sceneDone: { borderColor: '#E2C66A', borderWidth: 2 },
  windowFrame: { backgroundColor: '#D9BFA9', borderColor: '#A98870', borderRadius: 20, borderWidth: 6, height: 150, left: 22, overflow: 'hidden', position: 'absolute', right: 22, top: 22 },
  sky: { flex: 1, overflow: 'hidden', position: 'relative' }, daySky: { backgroundColor: '#BFE1F4' }, nightSky: { backgroundColor: '#263248' },
  sun: { fontSize: 29, position: 'absolute', right: 23, top: 15 }, moon: { color: '#FFF1BA', fontSize: 34, position: 'absolute', right: 28, top: 12 }, starA: { color: '#FFF2B8', fontSize: 18, left: 36, position: 'absolute', top: 18 }, starB: { color: '#FFF2B8', fontSize: 26, left: 94, position: 'absolute', top: 35 },
  skyline: { alignItems: 'flex-end', bottom: 0, flexDirection: 'row', gap: 3, left: 0, position: 'absolute', right: 0 }, building: { backgroundColor: '#49566B', flex: 1, minHeight: 24, position: 'relative' }, litWindow: { backgroundColor: '#FFD97B', height: 5, left: 4, position: 'absolute', top: 7, width: 4 },
  windowBarV: { backgroundColor: '#A98870', bottom: 0, left: '49%', position: 'absolute', top: 0, width: 5 }, windowBarH: { backgroundColor: '#A98870', height: 5, left: 0, position: 'absolute', right: 0, top: '53%' },
  curtainLeft: { backgroundColor: '#EAD4C4', borderBottomRightRadius: 22, bottom: 0, left: 0, opacity: 0.9, position: 'absolute', top: 0, width: 28 }, curtainRight: { backgroundColor: '#EAD4C4', borderBottomLeftRadius: 22, bottom: 0, opacity: 0.9, position: 'absolute', right: 0, top: 0, width: 28 },
  wallShelf: { backgroundColor: '#B88967', borderRadius: 6, left: 28, paddingHorizontal: 9, paddingVertical: 3, position: 'absolute', top: 183 }, shelfItems: { fontSize: 15 },
  lamp: { position: 'absolute', right: 25, top: 174 }, lampText: { fontSize: 24 },
  floor: { backgroundColor: '#B78766', bottom: 0, height: 158, left: 0, opacity: 0.9, position: 'absolute', right: 0 }, rug: { backgroundColor: '#D8B99F', borderRadius: 100, bottom: 24, height: 98, left: '15%', opacity: 0.8, position: 'absolute', width: '70%' },
  workbench: { backgroundColor: '#9F7153', borderRadius: 9, bottom: 111, left: 18, paddingHorizontal: 8, paddingVertical: 5, position: 'absolute' }, workbenchText: { fontSize: 15 }, planks: { bottom: 16, position: 'absolute', right: 15 }, plankText: { fontSize: 22 },
  sceneTitlePill: { alignItems: 'center', backgroundColor: 'rgba(255,249,243,0.91)', borderRadius: 16, left: '27%', paddingHorizontal: 13, paddingVertical: 7, position: 'absolute', top: 177, width: '46%' }, sceneTitle: { color: '#6B5142', fontSize: 11, fontWeight: '900' }, sceneTask: { color: '#917465', fontSize: 9, marginTop: 2 },
  worker: { alignItems: 'center', position: 'absolute', width: 86 }, workerBubbleRow: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'center' },
  namePill: { alignItems: 'center', backgroundColor: 'rgba(255,250,246,0.92)', borderRadius: 10, marginTop: 1, maxWidth: 84, paddingHorizontal: 6, paddingVertical: 3 }, meNamePill: { backgroundColor: '#FFF6E8' }, nameText: { color: '#5F4A3E', fontSize: 9, fontWeight: '800' }, npcTag: { color: '#947B6D', fontSize: 6, marginTop: 1 }, reaction: { fontSize: 18, position: 'absolute', right: -1, top: -10 },
  quoteBubble: { backgroundColor: '#FFFFFF', borderRadius: 14, left: 112, maxWidth: 170, paddingHorizontal: 10, paddingVertical: 7, position: 'absolute', top: 285 }, quoteText: { color: '#6B5548', fontSize: 10, lineHeight: 14 },
  helpSign: { alignItems: 'center', backgroundColor: '#FFCFB8', borderRadius: 15, height: 30, justifyContent: 'center', left: '47%', position: 'absolute', top: 244, width: 30 }, helpSignText: { color: '#8B4B34', fontSize: 18, fontWeight: '900' },
});
