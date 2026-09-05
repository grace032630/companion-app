import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimalCharacter } from '../components/AnimalCharacter';
import { ANIMAL_OPTIONS } from '../constants/crew';
import { checkInToday, fetchActivitySummary, type ActivitySummary } from '../lib/activity';
import { useAuth } from '../lib/auth';
import { useProfile } from '../lib/profile';
import { supabase } from '../lib/supabase';

const EMPTY_SUMMARY: ActivitySummary = {
  checkedInToday: false,
  streak: 0,
  todayCompleted: 0,
  weekCompleted: 0,
  recent: [],
};

export default function ProfileScreen() {
  const { session } = useAuth();
  const { profile, saveProfile } = useProfile();
  const [summary, setSummary] = useState<ActivitySummary>(EMPTY_SUMMARY);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(profile?.nickname ?? '');
  const [animal, setAnimal] = useState(profile?.animal ?? ANIMAL_OPTIONS[0]);
  const [saving, setSaving] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setNickname(profile?.nickname ?? '');
    setAnimal(profile?.animal ?? ANIMAL_OPTIONS[0]);
  }, [profile?.animal, profile?.nickname]);

  const loadSummary = async () => {
    const userId = session?.user.id;
    if (!userId) return;
    setLoadingSummary(true);
    try {
      setSummary(await fetchActivitySummary(userId));
    } catch {
      setSummary(EMPTY_SUMMARY);
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    void loadSummary();
  }, [session?.user.id]);

  const handleCheckIn = async () => {
    const userId = session?.user.id;
    if (!userId || summary.checkedInToday) return;
    setCheckingIn(true);
    setMessage(null);
    const { error } = await checkInToday(userId);
    if (error) {
      setMessage(error.message);
    } else {
      await loadSummary();
      setMessage('今天也來施工了 🔨');
    }
    setCheckingIn(false);
  };

  const handleSave = async () => {
    const cleaned = nickname.trim();
    if (!cleaned) {
      setMessage('暱稱不能空白');
      return;
    }
    if (cleaned.length > 16) {
      setMessage('暱稱最多 16 個字');
      return;
    }

    setSaving(true);
    setMessage(null);
    const result = await saveProfile({ nickname: cleaned, animal });
    setSaving(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setEditing(false);
    setMessage('角色更新好了');
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    setMessage(null);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setMessage(error.message);
      setSigningOut(false);
    }
  };

  if (!profile) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Text style={styles.backText}>‹</Text>
            </Pressable>
            <Text style={styles.headerTitle}>我的</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.identityCard}>
            <View style={styles.avatarLarge}>
              <AnimalCharacter animal={profile.animal} size="large" state="idle" />
            </View>
            <Text style={styles.name}>{profile.nickname}</Text>
            <Text style={styles.quote}>{profile.quote || '今天也慢慢來'}</Text>
            <Pressable onPress={() => setEditing((value) => !value)} style={styles.editButton}>
              <Text style={styles.editButtonText}>{editing ? '收起編輯' : '編輯角色'}</Text>
            </Pressable>
          </View>

          {editing && (
            <View style={styles.editCard}>
              <Text style={styles.sectionTitle}>換角色</Text>
              <View style={styles.animalGrid}>
                {ANIMAL_OPTIONS.map((item) => {
                  const selected = animal === item;
                  return (
                    <Pressable
                      key={item}
                      onPress={() => setAnimal(item)}
                      style={[styles.animalButton, selected && styles.animalSelected]}>
                      <AnimalCharacter animal={item} size="regular" state="idle" />
                      {selected && <Text style={styles.selectedMark}>✓</Text>}
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.sectionTitle}>改暱稱</Text>
              <TextInput
                maxLength={16}
                onChangeText={setNickname}
                placeholder="你的暱稱"
                placeholderTextColor="#B2A094"
                style={styles.input}
                value={nickname}
              />
              <Pressable disabled={saving} onPress={handleSave} style={styles.primaryButton}>
                {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>儲存</Text>}
              </Pressable>
            </View>
          )}

          <Text style={styles.sectionHeading}>每日施工</Text>
          <View style={styles.checkinCard}>
            <View>
              <Text style={styles.checkinTitle}>{summary.checkedInToday ? '今天有來施工 ✓' : '今天還沒打卡'}</Text>
              <Text style={styles.checkinSub}>連續施工 {summary.streak} 天</Text>
            </View>
            <Pressable
              disabled={summary.checkedInToday || checkingIn}
              onPress={handleCheckIn}
              style={[styles.checkinButton, summary.checkedInToday && styles.checkinButtonDone]}>
              {checkingIn ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.checkinButtonText}>{summary.checkedInToday ? '已打卡' : '今天來施工'}</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{summary.todayCompleted}</Text>
              <Text style={styles.statLabel}>今天完成</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{summary.weekCompleted}</Text>
              <Text style={styles.statLabel}>本週完成</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{summary.streak}</Text>
              <Text style={styles.statLabel}>連續天數</Text>
            </View>
          </View>

          <Text style={styles.sectionHeading}>施工日誌</Text>
          <View style={styles.logCard}>
            {loadingSummary ? (
              <ActivityIndicator color="#A86F4D" />
            ) : summary.recent.length === 0 ? (
              <Text style={styles.emptyText}>完成任務後 這裡會慢慢留下紀錄</Text>
            ) : (
              summary.recent.map((item) => (
                <View key={item.id} style={styles.logRow}>
                  <View style={styles.logDot} />
                  <View style={styles.logCopy}>
                    <Text style={styles.logTask}>{item.task}</Text>
                    <Text style={styles.logTime}>{new Date(item.completed_at).toLocaleString()}</Text>
                  </View>
                </View>
              ))
            )}
          </View>

          <Text style={styles.sectionHeading}>設定</Text>
          <View style={styles.settingsCard}>
            <Pressable style={styles.settingRow}>
              <Text style={styles.settingLabel}>今日一句</Text>
              <Text style={styles.settingValue}>之後開放 ›</Text>
            </Pressable>
            <Pressable style={styles.settingRow}>
              <Text style={styles.settingLabel}>通知</Text>
              <Text style={styles.settingValue}>之後開放 ›</Text>
            </Pressable>
            <Pressable style={styles.settingRow}>
              <Text style={styles.settingLabel}>隱私與帳號</Text>
              <Text style={styles.settingValue}>之後開放 ›</Text>
            </Pressable>
          </View>

          {message && <Text style={styles.message}>{message}</Text>}

          <Pressable disabled={signingOut} onPress={handleSignOut} style={styles.signOutButton}>
            {signingOut ? <ActivityIndicator color="#8A6450" /> : <Text style={styles.signOutText}>Sign out</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#FFF9F1', flex: 1 },
  flex: { flex: 1 },
  content: { paddingBottom: 44, paddingHorizontal: 22, paddingTop: 8 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  backButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  backText: { color: '#6C5648', fontSize: 38, lineHeight: 40 },
  headerTitle: { color: '#493D34', fontSize: 20, fontWeight: '900' },
  headerSpacer: { width: 44 },
  identityCard: { alignItems: 'center', backgroundColor: '#F3E1D3', borderColor: '#E4C8B4', borderRadius: 30, borderWidth: 1, marginTop: 14, padding: 24 },
  avatarLarge: { alignItems: 'center', backgroundColor: '#FFF9F3', borderRadius: 42, height: 84, justifyContent: 'center', width: 84 },
  name: { color: '#4E4037', fontSize: 24, fontWeight: '900', marginTop: 12 },
  quote: { color: '#8C7465', fontSize: 14, marginTop: 6 },
  editButton: { backgroundColor: '#FFFFFF', borderRadius: 14, marginTop: 16, paddingHorizontal: 16, paddingVertical: 10 },
  editButtonText: { color: '#7C5D4B', fontSize: 13, fontWeight: '800' },
  editCard: { backgroundColor: '#FFFFFF', borderColor: '#E8D6C8', borderRadius: 24, borderWidth: 1, marginTop: 14, padding: 18 },
  sectionTitle: { color: '#5C493D', fontSize: 14, fontWeight: '900', marginBottom: 10, marginTop: 8 },
  animalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  animalButton: { alignItems: 'center', backgroundColor: '#FFF9F4', borderColor: '#E8D8CB', borderRadius: 18, borderWidth: 1, height: 72, justifyContent: 'center', position: 'relative', width: '22%' },
  animalSelected: { backgroundColor: '#F7DED0', borderColor: '#B97855', borderWidth: 2 },
  selectedMark: { backgroundColor: '#A86F4D', borderRadius: 9, color: '#FFFFFF', fontSize: 9, fontWeight: '900', height: 18, lineHeight: 18, position: 'absolute', right: 5, textAlign: 'center', top: 5, width: 18 },
  input: { backgroundColor: '#FFF9F4', borderColor: '#E3CFC0', borderRadius: 16, borderWidth: 1, color: '#493D34', fontSize: 16, minHeight: 52, paddingHorizontal: 15 },
  primaryButton: { alignItems: 'center', backgroundColor: '#A86F4D', borderRadius: 16, justifyContent: 'center', marginTop: 14, minHeight: 50 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  sectionHeading: { color: '#5A483C', fontSize: 17, fontWeight: '900', marginBottom: 10, marginTop: 26 },
  checkinCard: { alignItems: 'center', backgroundColor: '#FFF1E5', borderColor: '#E7C9B5', borderRadius: 22, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', padding: 18 },
  checkinTitle: { color: '#5A4538', fontSize: 16, fontWeight: '900' },
  checkinSub: { color: '#927565', fontSize: 12, marginTop: 5 },
  checkinButton: { alignItems: 'center', backgroundColor: '#A86F4D', borderRadius: 14, justifyContent: 'center', minHeight: 42, minWidth: 96, paddingHorizontal: 12 },
  checkinButtonDone: { backgroundColor: '#B8A99E' },
  checkinButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  statCard: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E9D9CD', borderRadius: 18, borderWidth: 1, flex: 1, paddingVertical: 16 },
  statValue: { color: '#4D3F36', fontSize: 22, fontWeight: '900' },
  statLabel: { color: '#937B6C', fontSize: 11, marginTop: 4 },
  logCard: { backgroundColor: '#FFFFFF', borderColor: '#E9D9CD', borderRadius: 22, borderWidth: 1, padding: 18 },
  emptyText: { color: '#9C897B', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  logRow: { alignItems: 'center', flexDirection: 'row', paddingVertical: 9 },
  logDot: { backgroundColor: '#C78D69', borderRadius: 5, height: 10, marginRight: 10, width: 10 },
  logCopy: { flex: 1 },
  logTask: { color: '#57463B', fontSize: 14, fontWeight: '800' },
  logTime: { color: '#9A877A', fontSize: 11, marginTop: 3 },
  settingsCard: { backgroundColor: '#FFFFFF', borderColor: '#E9D9CD', borderRadius: 22, borderWidth: 1, overflow: 'hidden' },
  settingRow: { alignItems: 'center', borderBottomColor: '#F0E5DD', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 54, paddingHorizontal: 16 },
  settingLabel: { color: '#59483D', fontSize: 14, fontWeight: '700' },
  settingValue: { color: '#A08D80', fontSize: 12 },
  message: { color: '#805844', fontSize: 13, marginTop: 14, textAlign: 'center' },
  signOutButton: { alignItems: 'center', borderColor: '#DFC9B9', borderRadius: 16, borderWidth: 1, justifyContent: 'center', marginTop: 24, minHeight: 52 },
  signOutText: { color: '#8A6450', fontSize: 14, fontWeight: '800' },
});
