import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ImageBackground, PanResponder, StyleSheet, Text, View } from 'react-native';

import type { AnimalAnimationState, CrewMember } from '../types/crew';
import { AnimalCharacter } from './AnimalCharacter';
import { ConstructionAction } from './ConstructionAction';

const DAY_BACKGROUNDS = [
  require('../assets/backgrounds/room-day.png'),
  require('../assets/backgrounds/room-day-2.png'),
  require('../assets/backgrounds/room-day-3.png'),
  require('../assets/backgrounds/room-day-4.png'),
  require('../assets/backgrounds/room-day-5.png'),
];

const NIGHT_BACKGROUNDS = [
  require('../assets/backgrounds/room-night-1.png'),
  require('../assets/backgrounds/room-night-2.png'),
  require('../assets/backgrounds/room-night-3.png'),
];

function pickRoomBackground() {
  const hour = new Date().getHours();
  const isNight = hour >= 19 || hour < 4;
  const pool = isNight ? NIGHT_BACKGROUNDS : DAY_BACKGROUNDS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export type RoomCollision = {
  id: string;
  kind: 'push' | 'punch';
  actor: { animal: string; name: string; userId?: string; memberId?: string };
  target: { animal: string; name: string; userId?: string; memberId?: string };
};

type RoomSceneProps = {
  me: CrewMember;
  helpers: CrewMember[];
  myState: AnimalAnimationState;
  task: string;
  quote?: string | null;
  askingHelp?: boolean;
  finished?: boolean;
  elapsedTime?: string;
  collision?: RoomCollision | null;
};

type RoomSpot = { left: `${number}%`; top: number };

const ME_SPOT: RoomSpot = { left: '30%', top: 275 };
const SPOTS: RoomSpot[] = [
  { left: '-2%', top: 215 },
  { left: '63%', top: 215 },
  { left: '8%', top: 355 },
  { left: '57%', top: 355 },
  { left: '31%', top: 430 },
];

const CELEBRATION_MESSAGES = ['恭喜！', '做完啦！', '太強了吧！', '耶～～！', '辛苦啦！'];

function percentToNumber(value: `${number}%`) {
  return Number(value.replace('%', '')) / 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function Worker({ member, state = 'working', spot, delay = 0, forceHelp = false, quote, controlsLocked = false, hidden = false, onDragPositionChange, celebrationText }: {
  member: CrewMember;
  state?: AnimalAnimationState;
  spot: RoomSpot;
  delay?: number;
  forceHelp?: boolean;
  quote?: string | null;
  controlsLocked?: boolean;
  hidden?: boolean;
  onDragPositionChange?: (position: { x: number; y: number }) => void;
  celebrationText?: string;
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
        Animated.timing(walk, { duration: 1200 + delay / 2, toValue: 1, useNativeDriver: true }),
        Animated.timing(walk, { duration: 1200 + delay / 2, toValue: 0, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [delay, forceHelp, state, walk]);

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => Boolean(member.isMe && !controlsLocked),
      onMoveShouldSetPanResponder: (_, gesture) => Boolean(member.isMe && !controlsLocked && (Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3)),
      onPanResponderGrant: () => { dragStart.current = { ...dragCurrent.current }; },
      onPanResponderMove: (_, gesture) => {
        if (!member.isMe) return;
        drag.setValue({
          x: clamp(dragStart.current.x + gesture.dx, -145, 95),
          y: clamp(dragStart.current.y + gesture.dy, -25, 205),
        });
      },
      onPanResponderRelease: (_, gesture) => {
        if (!member.isMe) return;
        const next = {
          x: clamp(dragStart.current.x + gesture.dx, -145, 95),
          y: clamp(dragStart.current.y + gesture.dy, -25, 205),
        };
        dragCurrent.current = next;
        onDragPositionChange?.(next);
        Animated.spring(drag, { toValue: next, bounciness: 5, speed: 18, useNativeDriver: true }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(drag, { toValue: dragCurrent.current, bounciness: 5, speed: 18, useNativeDriver: true }).start();
      },
    }),
    [controlsLocked, drag, member.isMe, onDragPositionChange],
  );

  const driftX = walk.interpolate({ inputRange: [0, 1], outputRange: [-5, 6] });
  const autoAndDragX = Animated.add(drag.x, driftX);
  const visibleQuote = quote?.trim();

  return (
    <Animated.View
      {...(member.isMe ? panResponder.panHandlers : {})}
      style={[
        styles.worker,
        member.isMe && styles.draggableWorker,
        hidden && styles.hiddenWorker,
        { left: spot.left, top: spot.top, transform: [{ translateX: autoAndDragX }, { translateY: drag.y }] },
      ]}
    >
      {celebrationText ? (
        <View pointerEvents="none" style={styles.celebrationBubble}>
          <Text numberOfLines={2} style={styles.celebrationBubbleText}>{celebrationText}</Text>
        </View>
      ) : visibleQuote ? (
        <View pointerEvents="none" style={styles.followQuoteBubble}>
          <Text numberOfLines={3} style={styles.followQuoteText}>{visibleQuote}</Text>
        </View>
      ) : null}

      <View style={styles.workerBubbleRow}>
        <AnimalCharacter animal={member.animal} scaleMultiplier={1.5} size="regular" state={forceHelp ? 'idle' : state} />
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

function CelebrationEffects() {
  const [bursts] = useState(() => Array.from({ length: 6 }, () => ({ scale: new Animated.Value(0), opacity: new Animated.Value(0) })));

  useEffect(() => {
    const animations = bursts.map((burst, index) => Animated.loop(Animated.sequence([
      Animated.delay(index * 280),
      Animated.parallel([
        Animated.timing(burst.opacity, { duration: 120, toValue: 1, useNativeDriver: true }),
        Animated.spring(burst.scale, { bounciness: 16, speed: 16, toValue: 1, useNativeDriver: true }),
      ]),
      Animated.delay(420),
      Animated.parallel([
        Animated.timing(burst.opacity, { duration: 260, toValue: 0, useNativeDriver: true }),
        Animated.timing(burst.scale, { duration: 260, toValue: 1.55, useNativeDriver: true }),
      ]),
      Animated.delay(500),
      Animated.timing(burst.scale, { duration: 1, toValue: 0, useNativeDriver: true }),
    ])));
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [bursts]);

  const positions = [
    { left: '8%', top: 58, emoji: '🎆' },
    { left: '69%', top: 82, emoji: '🎇' },
    { left: '35%', top: 120, emoji: '✨' },
    { left: '16%', top: 165, emoji: '🎉' },
    { left: '76%', top: 190, emoji: '✨' },
    { left: '48%', top: 62, emoji: '🎆' },
  ] as const;

  return (
    <View pointerEvents="none" style={styles.celebrationLayer}>
      {bursts.map((burst, index) => (
        <Animated.Text key={index} style={[styles.firework, positions[index], { opacity: burst.opacity, transform: [{ scale: burst.scale }] }]}>
          {positions[index].emoji}
        </Animated.Text>
      ))}
      <View style={styles.celebrationBanner}><Text style={styles.celebrationBannerText}>🎊 任務完成！ 🎊</Text></View>
    </View>
  );
}

function CollisionAnimation({ collision, actorPoint, targetPoint }: { collision: RoomCollision; actorPoint: { x: number; y: number }; targetPoint: { x: number; y: number } }) {
  const [actorMove] = useState(() => new Animated.ValueXY(actorPoint));
  const [targetMove] = useState(() => new Animated.ValueXY(targetPoint));
  const [impactScale] = useState(() => new Animated.Value(0));
  const [targetRotate] = useState(() => new Animated.Value(0));
  const [starOpacity] = useState(() => new Animated.Value(0));
  const [starScale] = useState(() => new Animated.Value(0.6));

  useEffect(() => {
    actorMove.setValue(actorPoint);
    targetMove.setValue(targetPoint);
    impactScale.setValue(0);
    targetRotate.setValue(0);
    starOpacity.setValue(0);
    starScale.setValue(0.6);

    const dx = targetPoint.x - actorPoint.x;
    const direction = dx >= 0 ? 1 : -1;
    const hitX = targetPoint.x - direction * 38;
    const knockback = collision.kind === 'punch' ? 42 : 32;

    const animation = Animated.sequence([
      Animated.timing(actorMove, { duration: 520, toValue: { x: hitX, y: targetPoint.y }, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(actorMove, { duration: 150, toValue: { x: targetPoint.x - direction * 5, y: targetPoint.y }, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(targetMove, { duration: 160, toValue: { x: targetPoint.x + direction * knockback, y: targetPoint.y }, useNativeDriver: true }),
          Animated.delay(180),
          Animated.spring(targetMove, { bounciness: 8, speed: 12, toValue: targetPoint, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(targetRotate, { duration: 110, toValue: 1, useNativeDriver: true }),
          Animated.timing(targetRotate, { duration: 110, toValue: -1, useNativeDriver: true }),
          Animated.timing(targetRotate, { duration: 110, toValue: 0, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(impactScale, { duration: 100, toValue: 1.4, useNativeDriver: true }),
          Animated.delay(240),
          Animated.timing(impactScale, { duration: 300, toValue: 0, useNativeDriver: true }),
        ]),
        collision.kind === 'punch'
          ? Animated.sequence([
              Animated.parallel([
                Animated.timing(starOpacity, { duration: 120, toValue: 1, useNativeDriver: true }),
                Animated.spring(starScale, { bounciness: 15, speed: 14, toValue: 1, useNativeDriver: true }),
              ]),
              Animated.delay(650),
              Animated.parallel([
                Animated.timing(starOpacity, { duration: 350, toValue: 0, useNativeDriver: true }),
                Animated.timing(starScale, { duration: 350, toValue: 1.45, useNativeDriver: true }),
              ]),
            ])
          : Animated.delay(1),
      ]),
      Animated.timing(actorMove, { duration: 380, toValue: actorPoint, useNativeDriver: true }),
    ]);

    animation.start();
    return () => animation.stop();
  }, [actorMove, actorPoint.x, actorPoint.y, collision.id, collision.kind, impactScale, starOpacity, starScale, targetMove, targetPoint.x, targetPoint.y, targetRotate]);

  const rotate = targetRotate.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-11deg', '0deg', '11deg'] });

  return (
    <View pointerEvents="none" style={styles.collisionLayer}>
      <Animated.View style={[styles.collisionMovingActor, { transform: actorMove.getTranslateTransform() }]}>
        <AnimalCharacter animal={collision.actor.animal} scaleMultiplier={1.5} size="regular" state="working" />
        <Text style={styles.collisionName}>{collision.actor.name}</Text>
      </Animated.View>

      <Animated.Text style={[styles.collisionImpact, { left: targetPoint.x + 46, top: targetPoint.y + 15, opacity: impactScale, transform: [{ scale: impactScale }] }]}>
        {collision.kind === 'punch' ? '💥' : '💨'}
      </Animated.Text>

      {collision.kind === 'punch' ? (
        <Animated.Text style={[styles.punchStars, { left: targetPoint.x + 25, top: targetPoint.y - 26, opacity: starOpacity, transform: [{ scale: starScale }] }]}>⭐ ✨ ⭐</Animated.Text>
      ) : null}

      <Animated.View style={[styles.collisionMovingTarget, { transform: [...targetMove.getTranslateTransform(), { rotate }] }]}>
        <AnimalCharacter animal={collision.target.animal} scaleMultiplier={1.5} size="regular" state={collision.kind === 'punch' ? 'punched' : 'pushed'} />
        <Text style={styles.collisionName}>{collision.target.name}</Text>
      </Animated.View>
    </View>
  );
}

export function RoomScene({ me, helpers, myState, task, quote, askingHelp = false, finished = false, elapsedTime = '00:00', collision = null }: RoomSceneProps) {
  const [sceneWidth, setSceneWidth] = useState(0);
  const [meDragOffset, setMeDragOffset] = useState({ x: 0, y: 0 });
  const [roomBackground] = useState(() => pickRoomBackground());

  const resolveSpot = (participant: RoomCollision['actor'] | RoomCollision['target']) => {
    const isMe = participant.memberId === me.id || Boolean(participant.userId && participant.userId === me.userId);
    if (isMe) return { spot: ME_SPOT, offset: meDragOffset };
    const helperIndex = helpers.findIndex((member) => participant.memberId === member.id || Boolean(participant.userId && participant.userId === member.userId));
    return { spot: helperIndex >= 0 ? SPOTS[helperIndex] : ME_SPOT, offset: { x: 0, y: 0 } };
  };

  const toPoint = ({ spot, offset }: { spot: RoomSpot; offset: { x: number; y: number } }) => ({
    x: percentToNumber(spot.left) * sceneWidth + offset.x,
    y: spot.top + offset.y,
  });

  const actorPoint = collision ? toPoint(resolveSpot(collision.actor)) : { x: 0, y: 0 };
  const targetPoint = collision ? toPoint(resolveSpot(collision.target)) : { x: 0, y: 0 };

  return (
    <ImageBackground
      onLayout={(event) => setSceneWidth(event.nativeEvent.layout.width)}
      source={roomBackground}
      resizeMode="cover"
      style={[styles.scene, askingHelp && styles.sceneHelp, finished && styles.sceneDone]}
    >
      <View style={styles.sceneShade} />
      <View pointerEvents="none" style={styles.roomTimerPill}><Text style={styles.roomTimerText}>{elapsedTime}</Text></View>
      <View style={styles.sceneTitlePill}>
        <Text style={styles.sceneTitle}>{finished ? '施工完成 ✨' : askingHelp ? '先卡一下 會有人來' : '大家正在施工'}</Text>
        <Text style={styles.sceneTask}>{task}</Text>
      </View>

      <Worker
        member={me}
        state={myState}
        spot={ME_SPOT}
        delay={120}
        forceHelp={askingHelp}
        quote={quote}
        controlsLocked={Boolean(collision) || finished}
        hidden={Boolean(collision && (collision.actor.memberId === me.id || collision.target.memberId === me.id || collision.actor.userId === me.userId || collision.target.userId === me.userId))}
        onDragPositionChange={setMeDragOffset}
      />

      {helpers.slice(0, 5).map((member, index) => (
        <Worker
          key={member.id}
          member={member}
          state={finished ? 'done' : 'working'}
          spot={SPOTS[index]}
          delay={index * 170 + 80}
          quote={member.isNpc ? null : member.quote}
          controlsLocked={Boolean(collision) || finished}
          hidden={Boolean(collision && (
            collision.actor.memberId === member.id
            || collision.target.memberId === member.id
            || Boolean(collision.actor.userId && collision.actor.userId === member.userId)
            || Boolean(collision.target.userId && collision.target.userId === member.userId)
          ))}
          celebrationText={finished ? CELEBRATION_MESSAGES[index % CELEBRATION_MESSAGES.length] : undefined}
        />
      ))}

      {collision && sceneWidth > 0 ? <CollisionAnimation collision={collision} actorPoint={actorPoint} targetPoint={targetPoint} /> : null}
      {finished ? <CelebrationEffects /> : null}
      {askingHelp && <View style={styles.helpSign}><Text style={styles.helpSignText}>！</Text></View>}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  scene: { backgroundColor: '#EEDCCB', borderRadius: 28, height: 610, marginTop: 16, overflow: 'hidden', position: 'relative', width: '100%' },
  sceneShade: { backgroundColor: 'rgba(53,35,23,0.04)', bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  sceneHelp: { borderColor: '#E19B78', borderWidth: 2 },
  sceneDone: { borderColor: '#E2C66A', borderWidth: 2 },
  roomTimerPill: { alignItems: 'center', backgroundColor: 'rgba(255,249,243,0.90)', borderColor: 'rgba(109,79,59,0.14)', borderRadius: 12, borderWidth: 1, minWidth: 58, paddingHorizontal: 9, paddingVertical: 6, position: 'absolute', right: 12, top: 12, zIndex: 40 },
  roomTimerText: { color: '#5F4A3E', fontSize: 12, fontVariant: ['tabular-nums'], fontWeight: '900' },
  sceneTitlePill: { alignItems: 'center', backgroundColor: 'rgba(255,249,243,0.91)', borderRadius: 16, left: '27%', paddingHorizontal: 13, paddingVertical: 7, position: 'absolute', top: 177, width: '46%' },
  sceneTitle: { color: '#6B5142', fontSize: 11, fontWeight: '900' },
  sceneTask: { color: '#917465', fontSize: 9, marginTop: 2 },
  worker: { alignItems: 'center', position: 'absolute', width: 150 },
  hiddenWorker: { opacity: 0 },
  draggableWorker: { zIndex: 20 },
  workerBubbleRow: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'center' },
  namePill: { alignItems: 'center', backgroundColor: 'rgba(255,250,246,0.92)', borderRadius: 10, marginTop: 1, maxWidth: 84, paddingHorizontal: 6, paddingVertical: 3 },
  meNamePill: { backgroundColor: '#FFF6E8' },
  nameText: { color: '#5F4A3E', fontSize: 9, fontWeight: '800' },
  npcTag: { color: '#947B6D', fontSize: 6, marginTop: 1 },
  reaction: { fontSize: 18, position: 'absolute', right: -1, top: -10 },
  followQuoteBubble: { backgroundColor: '#FFFFFF', borderColor: '#E8D8CB', borderRadius: 14, borderWidth: 1, bottom: '100%', left: '50%', marginBottom: 6, maxWidth: 170, minWidth: 90, paddingHorizontal: 10, paddingVertical: 7, position: 'absolute', transform: [{ translateX: -45 }], zIndex: 30 },
  followQuoteText: { color: '#6B5548', fontSize: 10, lineHeight: 14, textAlign: 'center' },
  celebrationBubble: { backgroundColor: '#FFF7C9', borderColor: '#E7C45A', borderRadius: 13, borderWidth: 1, bottom: '100%', left: '50%', marginBottom: 5, minWidth: 62, paddingHorizontal: 9, paddingVertical: 6, position: 'absolute', transform: [{ translateX: -31 }], zIndex: 35 },
  celebrationBubbleText: { color: '#76551E', fontSize: 10, fontWeight: '900', textAlign: 'center' },
  celebrationLayer: { bottom: 0, left: 0, pointerEvents: 'none', position: 'absolute', right: 0, top: 0, zIndex: 70 },
  firework: { fontSize: 36, position: 'absolute' },
  celebrationBanner: { alignItems: 'center', backgroundColor: 'rgba(255,248,214,0.94)', borderColor: '#E8C85A', borderRadius: 18, borderWidth: 2, left: '24%', paddingHorizontal: 12, paddingVertical: 8, position: 'absolute', top: 135, width: '52%' },
  celebrationBannerText: { color: '#6D4B18', fontSize: 14, fontWeight: '900', textAlign: 'center' },
  collisionLayer: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0, zIndex: 80 },
  collisionMovingActor: { alignItems: 'center', left: 0, position: 'absolute', top: 0, width: 150 },
  collisionMovingTarget: { alignItems: 'center', left: 0, position: 'absolute', top: 0, width: 150 },
  collisionImpact: { fontSize: 28, position: 'absolute', zIndex: 10 },
  punchStars: { fontSize: 20, position: 'absolute', zIndex: 12 },
  collisionName: { backgroundColor: 'rgba(255,250,246,0.94)', borderRadius: 8, color: '#5F4A3E', fontSize: 8, fontWeight: '800', marginTop: -2, paddingHorizontal: 5, paddingVertical: 2 },
  helpSign: { alignItems: 'center', backgroundColor: '#FFCFB8', borderRadius: 15, height: 30, justifyContent: 'center', left: '47%', position: 'absolute', top: 244, width: 30 },
  helpSignText: { color: '#8B4B34', fontSize: 18, fontWeight: '900' },
});
