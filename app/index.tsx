import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimalCharacter } from '../components/AnimalCharacter';
import { useProfile } from '../lib/profile';

const TASKS = ['打掃', '寫報告', '讀書', '工作', '運動', '做家事', '整理東西', '洗澡', '整理帳單', '回覆訊息', '其他事項'];

export default function HomeScreen() {
  const { profile, loading: profileLoading } = useProfile();
  const [task, setTask] = useState<string | null>(null);

  if (profileLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#A86F4D" />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return <Redirect href="/profile-setup" />;
  }

  const handleStart = () => {
    if (!task) return;
    router.push({ pathname: '/room', params: { task } });
  };

  return (
    <ImageBackground
      source={require('../assets/backgrounds/room-day.png')}
      resizeMode="cover"
      style={styles.background}
    >
      <View style={styles.backgroundTint} />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          contentInsetAdjustmentBehavior="never"
          showsVerticalScrollIndicator={false}
          style={styles.scrollView}
        >
          <View style={styles.topRow}>
          <View>
            <Text style={styles.brand}>Companion</Text>
            <Text style={styles.nickname}>嗨 {profile.nickname}</Text>
          </View>
          <Pressable
            accessibilityLabel="打開我的資料"
            onPress={() => router.push('/profile')}
            style={({ pressed }) => [styles.avatar, pressed && styles.avatarPressed]}>
            <AnimalCharacter animal={profile.animal} size="small" state="idle" />
          </Pressable>
        </View>

        <View style={styles.hero}>
          <Text style={styles.prompt}>現在想做什麼呢？^^</Text>
          <Text style={styles.promptSub}>大家一起做事吧</Text>
          <View style={styles.companions}>
            <Text style={styles.companion}>🦊</Text>
            <Text style={styles.companion}>🐰</Text>
            <Text style={styles.companion}>🐻</Text>
          </View>
        </View>

        <View style={styles.chipWrap}>
          {TASKS.map((item) => {
            const selected = task === item;
            return (
              <Pressable
                key={item}
                onPress={() => setTask(item)}
                style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}>
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{item}</Text>
              </Pressable>
            );
          })}
        </View>

          <Pressable
            disabled={!task}
            onPress={handleStart}
            style={({ pressed }) => [styles.startButton, !task && styles.startButtonDisabled, pressed && task && styles.pressed]}>
            <Text style={[styles.startButtonText, !task && styles.startButtonTextDisabled]}>{task ? '一起開工' : '選一件事'}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, height: '100%', width: '100%' },
  backgroundTint: {
    backgroundColor: 'rgba(255,248,239,0.80)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  safeArea: { backgroundColor: 'transparent', flex: 1, minHeight: 0 },
  loadingWrap: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 24, paddingHorizontal: 24, paddingTop: 20 },
  topRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  brand: { color: '#493D34', fontSize: 24, fontWeight: '700' },
  nickname: { color: '#8A7A6E', fontSize: 13, marginTop: 4 },
  avatar: { alignItems: 'center', backgroundColor: '#F4E1CF', borderColor: '#E7CEBA', borderRadius: 24, borderWidth: 1, height: 48, justifyContent: 'center', width: 48 },
  avatarPressed: { opacity: 0.65, transform: [{ scale: 0.96 }] },
  hero: { backgroundColor: 'rgba(255,255,255,0.86)', borderColor: 'rgba(240,222,208,0.95)', borderRadius: 28, borderWidth: 1, marginBottom: 28, marginTop: 28, padding: 26, shadowColor: '#795E4B', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.10, shadowRadius: 18 },
  prompt: { color: '#493D34', fontSize: 29, fontWeight: '700', lineHeight: 40 },
  promptSub: { color: '#8B776A', fontSize: 13, marginTop: 4 },
  companions: { flexDirection: 'row', marginTop: 18 },
  companion: { fontSize: 30, marginRight: 9 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { backgroundColor: 'rgba(255,249,242,0.90)', borderColor: '#E3CDBB', borderRadius: 18, borderWidth: 1, paddingHorizontal: 15, paddingVertical: 11 },
  chipSelected: { backgroundColor: '#F2D9C4', borderColor: '#C88E69' },
  chipText: { color: '#6F6258', fontSize: 14, fontWeight: '600' },
  chipTextSelected: { color: '#6E432C' },
  startButton: { alignItems: 'center', backgroundColor: '#A86F4D', borderRadius: 18, justifyContent: 'center', marginTop: 28, minHeight: 56 },
  startButtonDisabled: { backgroundColor: 'rgba(229,216,206,0.92)' },
  startButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  startButtonTextDisabled: { color: '#9D8D82' },
  pressed: { opacity: 0.72 },
});
