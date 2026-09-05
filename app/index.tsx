import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimalCharacter } from '../components/AnimalCharacter';
import { useProfile } from '../lib/profile';
import { supabase } from '../lib/supabase';

const TASKS = ['打掃房間', '寫報告', '讀書', '工作', '運動', '做家事', '整理東西', '其他事項'];

export default function HomeScreen() {
  const { profile, loading: profileLoading } = useProfile();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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

  const handleSignOut = async () => {
    setIsSigningOut(true);
    setErrorMessage(null);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setErrorMessage(error.message);
      setIsSigningOut(false);
    }
  };

  const handleStart = () => {
    if (!task) return;
    router.push({ pathname: '/room', params: { task } });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.brand}>Companion</Text>
            <Text style={styles.nickname}>嗨 {profile.nickname}</Text>
          </View>
          <View style={styles.avatar}>
            <AnimalCharacter animal={profile.animal} size="small" state="idle" />
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.prompt}>現在想做什麼呢？^^</Text>
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

        <View style={styles.footer}>
          {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
          <Pressable disabled={isSigningOut} onPress={handleSignOut} style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}>
            {isSigningOut ? <ActivityIndicator color="#7C5D4B" /> : <Text style={styles.signOutText}>Sign out</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#FFF9F1', flex: 1 },
  loadingWrap: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  scrollContent: { paddingBottom: 32, paddingHorizontal: 24, paddingTop: 20 },
  topRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  brand: { color: '#493D34', fontSize: 24, fontWeight: '700' },
  nickname: { color: '#8A7A6E', fontSize: 13, marginTop: 4 },
  avatar: { alignItems: 'center', backgroundColor: '#F4E1CF', borderRadius: 24, height: 48, justifyContent: 'center', width: 48 },
  hero: { backgroundColor: '#FFFFFF', borderColor: '#F0DED0', borderRadius: 28, borderWidth: 1, marginBottom: 28, marginTop: 28, padding: 26, shadowColor: '#795E4B', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.08, shadowRadius: 18 },
  prompt: { color: '#493D34', fontSize: 29, fontWeight: '700', lineHeight: 40 },
  companions: { flexDirection: 'row', marginTop: 22 },
  companion: { fontSize: 30, marginRight: 9 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { backgroundColor: '#FFFFFF', borderColor: '#E7D7C8', borderRadius: 18, borderWidth: 1, paddingHorizontal: 15, paddingVertical: 11 },
  chipSelected: { backgroundColor: '#F2D9C4', borderColor: '#C88E69' },
  chipText: { color: '#6F6258', fontSize: 14, fontWeight: '600' },
  chipTextSelected: { color: '#6E432C' },
  startButton: { alignItems: 'center', backgroundColor: '#A86F4D', borderRadius: 18, justifyContent: 'center', marginTop: 28, minHeight: 56 },
  startButtonDisabled: { backgroundColor: '#E5D8CE' },
  startButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  startButtonTextDisabled: { color: '#9D8D82' },
  footer: { marginTop: 28 },
  signOutButton: { alignItems: 'center', borderColor: '#DCC7B6', borderRadius: 15, borderWidth: 1, height: 50, justifyContent: 'center' },
  signOutText: { color: '#7C5D4B', fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.72 },
  errorText: { color: '#9B4F3B', fontSize: 13, marginBottom: 10, textAlign: 'center' },
});
