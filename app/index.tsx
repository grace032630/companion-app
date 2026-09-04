import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

const TASKS = ['打掃房間', '寫報告', '讀書', '工作', '運動', '做家事', '整理東西', '其他事項'];
const DURATIONS = ['5 分鐘', '15 分鐘', '30 分鐘', '60 分鐘', '不確定'];
const COMPANION_MODES = [
  { key: 'together', icon: '🤝', label: '手牽手一起做', note: '找人一起開始' },
  { key: 'quiet', icon: '🌙', label: '安靜陪伴', note: '不用聊天也可以' },
  { key: 'coax', icon: '🫶', label: '哄著我做', note: '給我一點鼓勵' },
];

export default function HomeScreen() {
  const { session } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [task, setTask] = useState<string | null>(null);
  const [duration, setDuration] = useState<string | null>(null);
  const [companionMode, setCompanionMode] = useState<string | null>(null);

  const canStart = useMemo(() => Boolean(task && duration && companionMode), [task, duration, companionMode]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    setErrorMessage(null);

    const { error } = await supabase.auth.signOut();

    if (error) {
      setErrorMessage(error.message);
      setIsSigningOut(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.brand}>Companion</Text>
            {session?.user.email && <Text style={styles.email}>{session.user.email}</Text>}
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>🐻</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.overline}>LET'S START TOGETHER</Text>
          <Text style={styles.prompt}>現在想做什麼呢？^^</Text>
          <Text style={styles.helper}>選一件小事就好，不用一次把全部做完。</Text>
          <View style={styles.companions}>
            <Text style={styles.companion}>🦊</Text>
            <Text style={styles.companion}>🐰</Text>
            <Text style={styles.companion}>🐻</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>想做什麼？</Text>
        <View style={styles.chipWrap}>
          {TASKS.map((item) => {
            const selected = task === item;
            return (
              <Pressable
                key={item}
                onPress={() => setTask(item)}
                style={({ pressed }) => [
                  styles.chip,
                  selected && styles.chipSelected,
                  pressed && styles.pressed,
                ]}>
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{item}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>大概做多久？</Text>
        <View style={styles.chipWrap}>
          {DURATIONS.map((item) => {
            const selected = duration === item;
            return (
              <Pressable
                key={item}
                onPress={() => setDuration(item)}
                style={({ pressed }) => [
                  styles.durationChip,
                  selected && styles.chipSelected,
                  pressed && styles.pressed,
                ]}>
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{item}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>今天想怎麼被陪？</Text>
        <View style={styles.modeList}>
          {COMPANION_MODES.map((mode) => {
            const selected = companionMode === mode.key;
            return (
              <Pressable
                key={mode.key}
                onPress={() => setCompanionMode(mode.key)}
                style={({ pressed }) => [
                  styles.modeCard,
                  selected && styles.modeCardSelected,
                  pressed && styles.pressed,
                ]}>
                <Text style={styles.modeIcon}>{mode.icon}</Text>
                <View style={styles.modeCopy}>
                  <Text style={[styles.modeLabel, selected && styles.modeLabelSelected]}>{mode.label}</Text>
                  <Text style={styles.modeNote}>{mode.note}</Text>
                </View>
                <Text style={[styles.radio, selected && styles.radioSelected]}>{selected ? '●' : '○'}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          disabled={!canStart}
          onPress={() => undefined}
          style={({ pressed }) => [
            styles.startButton,
            !canStart && styles.startButtonDisabled,
            pressed && canStart && styles.startButtonPressed,
          ]}>
          <Text style={[styles.startButtonText, !canStart && styles.startButtonTextDisabled]}>
            {canStart ? '一起開工' : '先選好上面的三項'}
          </Text>
        </Pressable>

        <View style={styles.footer}>
          {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
          <Pressable
            accessibilityRole="button"
            disabled={isSigningOut}
            onPress={handleSignOut}
            style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}>
            {isSigningOut ? (
              <ActivityIndicator color="#7C5D4B" />
            ) : (
              <Text style={styles.signOutText}>Sign out</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FFF9F1',
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  brand: {
    color: '#493D34',
    fontSize: 24,
    fontWeight: '700',
  },
  email: {
    color: '#8A7A6E',
    fontSize: 13,
    marginTop: 4,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#F4E1CF',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  avatarText: {
    fontSize: 27,
  },
  hero: {
    backgroundColor: '#FFFFFF',
    borderColor: '#F0DED0',
    borderRadius: 28,
    borderWidth: 1,
    marginTop: 28,
    padding: 26,
    shadowColor: '#795E4B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
  overline: {
    color: '#A36E50',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    marginBottom: 14,
  },
  prompt: {
    color: '#493D34',
    fontSize: 29,
    fontWeight: '700',
    lineHeight: 40,
  },
  helper: {
    color: '#8A7A6E',
    fontSize: 15,
    lineHeight: 23,
    marginTop: 12,
  },
  companions: {
    flexDirection: 'row',
    marginTop: 22,
  },
  companion: {
    fontSize: 30,
    marginRight: 9,
  },
  sectionTitle: {
    color: '#493D34',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 28,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E7D7C8',
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  durationChip: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E7D7C8',
    borderRadius: 18,
    borderWidth: 1,
    minWidth: 82,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  chipSelected: {
    backgroundColor: '#F2D9C4',
    borderColor: '#C88E69',
  },
  chipText: {
    color: '#6F6258',
    fontSize: 14,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#6E432C',
  },
  modeList: {
    gap: 10,
  },
  modeCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E7D7C8',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  modeCardSelected: {
    backgroundColor: '#FFF2E7',
    borderColor: '#C88E69',
  },
  modeIcon: {
    fontSize: 26,
    marginRight: 13,
  },
  modeCopy: {
    flex: 1,
  },
  modeLabel: {
    color: '#55483E',
    fontSize: 15,
    fontWeight: '700',
  },
  modeLabelSelected: {
    color: '#6E432C',
  },
  modeNote: {
    color: '#98877A',
    fontSize: 12,
    marginTop: 3,
  },
  radio: {
    color: '#C9B6A7',
    fontSize: 20,
  },
  radioSelected: {
    color: '#B87754',
  },
  startButton: {
    alignItems: 'center',
    backgroundColor: '#A86F4D',
    borderRadius: 18,
    justifyContent: 'center',
    marginTop: 28,
    minHeight: 56,
  },
  startButtonDisabled: {
    backgroundColor: '#E5D8CE',
  },
  startButtonPressed: {
    opacity: 0.86,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  startButtonTextDisabled: {
    color: '#9D8D82',
  },
  footer: {
    marginTop: 28,
  },
  signOutButton: {
    alignItems: 'center',
    borderColor: '#DCC7B6',
    borderRadius: 15,
    borderWidth: 1,
    height: 50,
    justifyContent: 'center',
  },
  signOutText: {
    color: '#7C5D4B',
    fontSize: 15,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.72,
  },
  errorText: {
    color: '#9B4F3B',
    fontSize: 13,
    marginBottom: 10,
    textAlign: 'center',
  },
});
