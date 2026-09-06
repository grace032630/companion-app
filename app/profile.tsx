import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
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
import { MAX_QUOTE_LENGTH, validatePublicQuote } from '../lib/content-filter';
import {
  fetchFriends,
  fetchPendingFriendRequests,
  type Friend,
} from '../lib/friends';
import { LANGUAGE_OPTIONS } from '../lib/i18n';
import { useProfile, type AppLanguage } from '../lib/profile';
import { claimDailyStrawberry, fetchStrawberryTotal } from '../lib/strawberries';
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
  const [strawberryTotal, setStrawberryTotal] = useState(0);
  const [strawberryOpen, setStrawberryOpen] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(profile?.nickname ?? '');
  const [animal, setAnimal] = useState(profile?.animal ?? ANIMAL_OPTIONS[0]);
  const [quote, setQuote] = useState(profile?.quote ?? '');
  const [language, setLanguage] = useState<AppLanguage>(profile?.language ?? 'zh-TW');
  const [saving, setSaving] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingFriendCount, setPendingFriendCount] = useState(0);
  const [loadingFriends, setLoadingFriends] = useState(true);

  useEffect(() => {
    setNickname(profile?.nickname ?? '');
    setAnimal(profile?.animal ?? ANIMAL_OPTIONS[0]);
    setQuote(profile?.quote ?? '');
    setLanguage(profile?.language ?? 'zh-TW');
  }, [profile]);

  const loadSummary = async () => {
    const userId = session?.user.id;
    if (!userId) return;
    setLoadingSummary(true);
    try {
      const nextSummary = await fetchActivitySummary(userId);
      setSummary(nextSummary);
      try {
        if (nextSummary.todayCompleted > 0) {
          const claimed = await claimDailyStrawberry();
          if (claimed) setStrawberryOpen(true);
        }
        setStrawberryTotal(await fetchStrawberryTotal(userId));
      } catch {
        // Strawberry rewards are optional until the migration has been applied.
      }
    } catch {
      setSummary(EMPTY_SUMMARY);
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    void loadSummary();
  }, [session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      if (!session?.user.id) return;
      let active = true;

      const loadFriendPreview = async () => {
        setLoadingFriends(true);
        try {
          const [nextRequests, nextFriends] = await Promise.all([
            fetchPendingFriendRequests(),
            fetchFriends(),
          ]);
          if (!active) return;
          setPendingFriendCount(nextRequests.length);
          setFriends(nextFriends);
        } catch {
          if (!active) return;
          setPendingFriendCount(0);
          setFriends([]);
        } finally {
          if (active) setLoadingFriends(false);
        }
      };

      void loadFriendPreview();
      return () => {
        active = false;
      };
    }, [session?.user.id]),
  );

  const handleCheckIn = async () => {
    const userId = session?.user.id;
    if (!userId || summary.checkedInToday) return;
    setCheckingIn(true);
    setMessage(null);
    const { error } = await checkInToday(userId);
    if (error) setMessage(error.message);
    else {
      await loadSummary();
      setMessage('今天也來施工了 🔨');
    }
    setCheckingIn(false);
  };

  const handleSave = async () => {
    const cleaned = nickname.trim();
    if (!cleaned) return setMessage('暱稱不能空白');
    if (cleaned.length > 16) return setMessage('暱稱最多 16 個字');
    const checked = validatePublicQuote(quote);
    if (!checked.ok) return setMessage(checked.message);

    setSaving(true);
    setMessage(null);
    const result = await saveProfile({
      nickname: cleaned,
      animal,
      quote: checked.value || null,
      language,
    });
    setSaving(false);
    if (result.error) return setMessage(result.error);
    setEditing(false);
    setMessage('存好了');
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
        <View style={styles.pageShell}>
          <View pointerEvents="none" style={styles.pageDecor}>
            <Text style={styles.sparkRowA}>✦   ✧   ✦   ✧   ✦   ✧</Text>
            <Text style={styles.sparkRowB}>✧   ✦   ✧   ✦   ✧   ✦</Text>
            <Text style={styles.sparkRowC}>✦   ✧   ✦   ✧   ✦   ✧</Text>
            <Text style={styles.sparkRowD}>✧   ✦   ✧   ✦   ✧   ✦</Text>
            <Text style={styles.sparkRowE}>✦   ✧   ✦   ✧   ✦   ✧</Text>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <Pressable onPress={() => router.back()} style={styles.backButton}>
                <Text style={styles.backText}>‹</Text>
              </Pressable>
              <Text style={styles.headerTitle}>我的</Text>
              <View style={styles.headerSpacer} />
            </View>

            <ImageBackground
              source={require('../assets/backgrounds/profile-room.png')}
              resizeMode="contain"
              imageStyle={styles.identitySceneImage}
              style={styles.identityScene}
            >
              <View style={styles.characterWrap}>
                <View style={styles.characterStage}>
                  <AnimalCharacter animal={profile.animal} size="large" state="idle" />
                </View>
                <Text style={styles.avatarLamp}>💡</Text>
              </View>

              <Text style={styles.name}>{profile.nickname}</Text>
              <View style={styles.profilePillsRow}>
                <View style={styles.levelPill}>
                  <Text style={styles.levelText}>施工 {summary.todayCompleted + summary.weekCompleted} 次</Text>
                </View>
                <View style={styles.strawberryPill}>
                  <Text style={styles.strawberryPillText}>🍓 {strawberryTotal}</Text>
                </View>
              </View>

              {profile.quote ? (
                <View style={styles.speechBubble}>
                  <Text style={styles.quote}>「{profile.quote}」</Text>
                </View>
              ) : null}

              <Pressable onPress={() => setEditing((value) => !value)} style={styles.editButton}>
                <Text style={styles.editButtonText}>{editing ? '收起編輯' : '編輯角色'}</Text>
              </Pressable>
            </ImageBackground>

            {editing ? (
              <View style={styles.editCard}>
                <Text style={styles.sectionTitle}>換角色</Text>
                <View style={styles.animalGrid}>
                  {ANIMAL_OPTIONS.map((item) => (
                    <Pressable
                      key={item}
                      onPress={() => setAnimal(item)}
                      style={[styles.animalButton, animal === item && styles.animalSelected]}
                    >
                      <AnimalCharacter animal={item} size="regular" state="idle" />
                      {animal === item ? <Text style={styles.selectedMark}>✓</Text> : null}
                    </Pressable>
                  ))}
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

                <Text style={styles.sectionTitle}>每日一句</Text>
                <TextInput
                  maxLength={MAX_QUOTE_LENGTH}
                  multiline
                  onChangeText={setQuote}
                  placeholder="例如 今天先完成一件事"
                  placeholderTextColor="#B2A094"
                  style={[styles.input, styles.quoteInput]}
                  value={quote}
                />
                <Text style={styles.counter}>{quote.length}/{MAX_QUOTE_LENGTH}</Text>

                <Text style={styles.sectionTitle}>語言</Text>
                <View style={styles.languageGrid}>
                  {LANGUAGE_OPTIONS.map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() => setLanguage(item.id)}
                      style={[styles.languageButton, language === item.id && styles.languageSelected]}
                    >
                      <Text style={styles.languageText}>{item.label}</Text>
                    </Pressable>
                  ))}
                </View>

                <Pressable disabled={saving} onPress={handleSave} style={styles.primaryButton}>
                  {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>儲存</Text>}
                </Pressable>
              </View>
            ) : null}

            <View style={styles.sectionHeadingRow}>
              <Text style={styles.sectionHeadingInline}>每日施工</Text>
              <Text style={styles.sectionPlant}>🪴</Text>
            </View>

            <View style={styles.questBoard}>
              <View style={styles.questPin}><Text style={styles.questPinText}>📌</Text></View>
              <View style={styles.questCopy}>
                <Text style={styles.checkinTitle}>{summary.checkedInToday ? '今天有來施工 ✓' : '今天還沒打卡'}</Text>
                <Text style={styles.checkinSub}>連續施工 {summary.streak} 天</Text>
              </View>
              <Pressable
                disabled={summary.checkedInToday || checkingIn}
                onPress={handleCheckIn}
                style={[styles.checkinButton, summary.checkedInToday && styles.checkinButtonDone]}
              >
                {checkingIn ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.checkinButtonText}>{summary.checkedInToday ? '已打卡' : '今天來施工'}</Text>
                )}
              </Pressable>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.badgeCard}><Text style={styles.badgeIcon}>☀️</Text><Text style={styles.statValue}>{summary.todayCompleted}</Text><Text style={styles.statLabel}>今天完成</Text></View>
              <View style={styles.badgeCard}><Text style={styles.badgeIcon}>🧱</Text><Text style={styles.statValue}>{summary.weekCompleted}</Text><Text style={styles.statLabel}>本週完成</Text></View>
              <View style={styles.badgeCard}><Text style={styles.badgeIcon}>🔥</Text><Text style={styles.statValue}>{summary.streak}</Text><Text style={styles.statLabel}>連續天數</Text></View>
            </View>

            <Text style={styles.sectionHeading}>好友</Text>
            <Pressable onPress={() => router.push('/friends')} style={styles.friendPreviewCard}>
              <View style={styles.friendPreviewHeader}>
                <Text style={styles.friendPreviewCount}>{loadingFriends ? '好友讀取中…' : '好友小屋'}</Text>
                <Text style={styles.friendPreviewLink}>查看全部 ›</Text>
              </View>
              {pendingFriendCount > 0 ? (
                <View style={styles.pendingHint}>
                  <Text style={styles.pendingHintText}>💌 有 {pendingFriendCount} 個好友邀請</Text>
                </View>
              ) : null}
              {!loadingFriends && friends.length === 0 ? (
                <Text style={styles.friendPreviewEmpty}>還沒有好友，去邀請施工夥伴吧～</Text>
              ) : (
                <View style={styles.friendPreviewList}>
                  {friends.slice(0, 3).map((friend) => (
                    <View key={friend.userId} style={styles.friendPreviewPerson}>
                      <View style={styles.friendPreviewCharacter}>
                        <AnimalCharacter animal={friend.animal} size="small" state="idle" />
                      </View>
                      <Text numberOfLines={1} style={styles.friendPreviewName}>{friend.nickname}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Pressable>

            <Text style={styles.sectionHeading}>施工日誌</Text>
            <View style={styles.logCard}>
              {loadingSummary ? (
                <ActivityIndicator color="#A86F4D" />
              ) : summary.recent.length === 0 ? (
                <Text style={styles.emptyText}>完成任務後 這裡會慢慢留下紀錄</Text>
              ) : (
                <>
                  {summary.recent.map((item) => (
                    <View key={item.id} style={styles.logRow}>
                      <View style={styles.logDot} />
                      <View style={styles.logCopy}>
                        <Text style={styles.logTask}>{item.task}</Text>
                        <Text style={styles.logTime}>{new Date(item.completed_at).toLocaleString()}</Text>
                      </View>
                    </View>
                  ))}
                  <Pressable onPress={() => router.push('/activity-log')} style={styles.logMoreButton}>
                    <Text style={styles.logMoreText}>查看全部紀錄 ›</Text>
                  </Pressable>
                </>
              )}
            </View>

            <Text style={styles.sectionHeading}>設定</Text>
            <View style={styles.settingsCard}>
              <Pressable onPress={() => setEditing(true)} style={styles.settingRow}>
                <Text style={styles.settingLabel}>每日一句</Text>
                <Text numberOfLines={1} style={styles.settingValue}>{profile.quote || '設定 ›'}</Text>
              </Pressable>
              <Pressable onPress={() => setEditing(true)} style={styles.settingRow}>
                <Text style={styles.settingLabel}>語言</Text>
                <Text style={styles.settingValue}>{LANGUAGE_OPTIONS.find((item) => item.id === profile.language)?.label ?? '繁體中文'} ›</Text>
              </Pressable>
              <Pressable style={styles.settingRow}>
                <Text style={styles.settingLabel}>通知</Text><Text style={styles.settingValue}>之後開放 ›</Text>
              </Pressable>
              <Pressable style={styles.settingRow}>
                <Text style={styles.settingLabel}>隱私與帳號</Text><Text style={styles.settingValue}>之後開放 ›</Text>
              </Pressable>
            </View>

            {message ? <Text style={styles.message}>{message}</Text> : null}
            <Pressable disabled={signingOut} onPress={handleSignOut} style={styles.signOutButton}>
              {signingOut ? <ActivityIndicator color="#8A6450" /> : <Text style={styles.signOutText}>Sign out</Text>}
            </Pressable>
          </ScrollView>

          <Modal animationType="fade" onRequestClose={() => setStrawberryOpen(false)} transparent visible={strawberryOpen}>
            <View style={styles.rewardOverlay}>
              <View style={styles.rewardCard}>
                <Text style={styles.rewardEmoji}>🍓</Text>
                <Text style={styles.rewardTitle}>補發今天的草莓！</Text>
                <Text style={styles.rewardSubtitle}>你今天已經完成每日施工，所以照樣算 +1</Text>
                <Pressable onPress={() => setStrawberryOpen(false)} style={styles.rewardButton}>
                  <Text style={styles.rewardButtonText}>收下草莓</Text>
                </Pressable>
              </View>
            </View>
          </Modal>

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#FFF7EF', flex: 1 },
  flex: { flex: 1 },
  pageShell: { flex: 1, position: 'relative' },
  content: { paddingBottom: 44, paddingHorizontal: 22, paddingTop: 8 },
  pageDecor: { bottom: 0, left: 0, overflow: 'hidden', position: 'absolute', right: 0, top: 0, zIndex: 0 },
  sparkRowA: { color: 'rgba(198,139,88,0.48)', fontSize: 19, left: -20, letterSpacing: 8, position: 'absolute', top: 95, transform: [{ rotate: '-18deg' }] },
  sparkRowB: { color: 'rgba(198,139,88,0.42)', fontSize: 18, letterSpacing: 8, position: 'absolute', right: -28, top: 285, transform: [{ rotate: '-18deg' }] },
  sparkRowC: { color: 'rgba(198,139,88,0.38)', fontSize: 19, left: -18, letterSpacing: 8, position: 'absolute', top: 500, transform: [{ rotate: '-18deg' }] },
  sparkRowD: { color: 'rgba(198,139,88,0.34)', fontSize: 18, letterSpacing: 8, position: 'absolute', right: -24, top: 710, transform: [{ rotate: '-18deg' }] },
  sparkRowE: { color: 'rgba(198,139,88,0.30)', fontSize: 19, left: -20, letterSpacing: 8, position: 'absolute', top: 920, transform: [{ rotate: '-18deg' }] },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  backButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  backText: { color: '#6C5648', fontSize: 38, lineHeight: 40 },
  headerTitle: { color: '#493D34', fontSize: 20, fontWeight: '900' },
  headerSpacer: { width: 44 },
  identityScene: { alignItems: 'center', backgroundColor: '#F6E6D6', borderColor: '#E1C6B0', borderRadius: 30, borderWidth: 1, marginTop: 14, minHeight: 300, overflow: 'hidden', paddingBottom: 22, paddingHorizontal: 22, paddingTop: 28 },
  identitySceneImage: { borderRadius: 30 },
  characterWrap: { position: 'relative' },
  characterStage: { alignItems: 'center', backgroundColor: 'rgba(255,248,239,0.92)', borderColor: '#E4CDB8', borderRadius: 54, borderWidth: 1, height: 108, justifyContent: 'center', width: 108 },
  avatarLamp: { fontSize: 22, position: 'absolute', right: -14, top: -12 },
  name: { color: '#4E4037', fontSize: 24, fontWeight: '900', marginTop: 12 },
  profilePillsRow: { flexDirection: 'row', gap: 8, marginTop: 7 },
  levelPill: { backgroundColor: 'rgba(239,211,185,0.92)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  levelText: { color: '#7A583F', fontSize: 11, fontWeight: '800' },
  strawberryPill: { backgroundColor: 'rgba(255,232,235,0.94)', borderColor: '#E9B9C1', borderRadius: 12, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  strawberryPillText: { color: '#A54F61', fontSize: 11, fontWeight: '900' },
  speechBubble: { backgroundColor: 'rgba(255,255,255,0.92)', borderColor: '#E7D8CC', borderRadius: 15, borderWidth: 1, marginTop: 10, maxWidth: '88%', paddingHorizontal: 13, paddingVertical: 9 },
  quote: { color: '#735D50', fontSize: 13, textAlign: 'center' },
  editButton: { backgroundColor: 'rgba(255,255,255,0.92)', borderColor: '#E7D8CC', borderRadius: 14, borderWidth: 1, marginTop: 16, paddingHorizontal: 16, paddingVertical: 10 },
  editButtonText: { color: '#7C5D4B', fontSize: 13, fontWeight: '800' },
  editCard: { backgroundColor: '#FFFFFF', borderColor: '#E8D6C8', borderRadius: 24, borderWidth: 1, marginTop: 14, padding: 18 },
  sectionTitle: { color: '#5C493D', fontSize: 14, fontWeight: '900', marginBottom: 10, marginTop: 12 },
  animalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  animalButton: { alignItems: 'center', backgroundColor: '#FFF9F4', borderColor: '#E8D8CB', borderRadius: 18, borderWidth: 1, height: 72, justifyContent: 'center', position: 'relative', width: '22%' },
  animalSelected: { backgroundColor: '#F7DED0', borderColor: '#B97855', borderWidth: 2 },
  selectedMark: { backgroundColor: '#A86F4D', borderRadius: 9, color: '#FFFFFF', fontSize: 9, fontWeight: '900', height: 18, lineHeight: 18, position: 'absolute', right: 5, textAlign: 'center', top: 5, width: 18 },
  input: { backgroundColor: '#FFF9F4', borderColor: '#E3CFC0', borderRadius: 16, borderWidth: 1, color: '#493D34', fontSize: 16, minHeight: 52, paddingHorizontal: 15, paddingVertical: 12 },
  quoteInput: { minHeight: 76, textAlignVertical: 'top' },
  counter: { color: '#A08D80', fontSize: 10, marginTop: 4, textAlign: 'right' },
  languageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  languageButton: { backgroundColor: '#FFF9F4', borderColor: '#E3CFC0', borderRadius: 13, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 9 },
  languageSelected: { backgroundColor: '#F7DED0', borderColor: '#B97855' },
  languageText: { color: '#674F41', fontSize: 12, fontWeight: '700' },
  primaryButton: { alignItems: 'center', backgroundColor: '#A86F4D', borderRadius: 16, justifyContent: 'center', marginTop: 16, minHeight: 50 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  sectionHeading: { color: '#5A483C', fontSize: 17, fontWeight: '900', marginBottom: 10, marginTop: 26 },
  sectionHeadingRow: { alignItems: 'center', flexDirection: 'row', gap: 6, marginTop: 26 },
  sectionHeadingInline: { color: '#5A483C', fontSize: 17, fontWeight: '900', marginBottom: 10 },
  sectionPlant: { fontSize: 21, marginBottom: 8 },
  questBoard: { alignItems: 'center', backgroundColor: '#F1D9BE', borderColor: '#D5AF87', borderRadius: 22, borderWidth: 1, flexDirection: 'row', padding: 16 },
  questPin: { alignItems: 'center', backgroundColor: '#FFF7EE', borderRadius: 18, height: 36, justifyContent: 'center', marginRight: 10, width: 36 },
  questPinText: { fontSize: 18 },
  questCopy: { flex: 1 },
  checkinTitle: { color: '#5A4538', fontSize: 16, fontWeight: '900' },
  checkinSub: { color: '#927565', fontSize: 12, marginTop: 5 },
  checkinButton: { alignItems: 'center', backgroundColor: '#A86F4D', borderRadius: 14, justifyContent: 'center', minHeight: 42, minWidth: 96, paddingHorizontal: 12 },
  checkinButtonDone: { backgroundColor: '#B8A99E' },
  checkinButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  badgeCard: { alignItems: 'center', backgroundColor: '#FFFDF9', borderColor: '#E3D2C3', borderRadius: 20, borderWidth: 1, flex: 1, paddingBottom: 14, paddingTop: 12 },
  badgeIcon: { fontSize: 18, marginBottom: 2 },
  statValue: { color: '#4D3F36', fontSize: 22, fontWeight: '900' },
  statLabel: { color: '#937B6C', fontSize: 11, marginTop: 4 },
  friendPreviewCard: { backgroundColor: '#FFFFFF', borderColor: '#E9D9CD', borderRadius: 22, borderWidth: 1, padding: 16 },
  friendPreviewHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  friendPreviewCount: { color: '#5A483C', fontSize: 14, fontWeight: '900' },
  friendPreviewLink: { color: '#8A6450', fontSize: 12, fontWeight: '900' },
  pendingHint: { alignSelf: 'flex-start', backgroundColor: '#FFF0E2', borderRadius: 11, marginTop: 10, paddingHorizontal: 10, paddingVertical: 6 },
  pendingHintText: { color: '#9A664A', fontSize: 11, fontWeight: '800' },
  friendPreviewList: { flexDirection: 'row', gap: 12, marginTop: 13 },
  friendPreviewPerson: { alignItems: 'center', flex: 1, minWidth: 0 },
  friendPreviewCharacter: { alignItems: 'center', backgroundColor: '#FFF7EF', borderRadius: 24, height: 48, justifyContent: 'center', width: 48 },
  friendPreviewName: { color: '#674F41', fontSize: 11, fontWeight: '800', marginTop: 5, maxWidth: '100%' },
  friendPreviewEmpty: { color: '#9C897B', fontSize: 12, marginTop: 13, textAlign: 'center' },
  logCard: { backgroundColor: '#FFFFFF', borderColor: '#E9D9CD', borderRadius: 22, borderWidth: 1, padding: 18 },
  emptyText: { color: '#9C897B', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  logRow: { alignItems: 'center', flexDirection: 'row', paddingVertical: 9 },
  logDot: { backgroundColor: '#C78D69', borderRadius: 5, height: 10, marginRight: 10, width: 10 },
  logCopy: { flex: 1 },
  logTask: { color: '#57463B', fontSize: 14, fontWeight: '800' },
  logTime: { color: '#9A877A', fontSize: 11, marginTop: 3 },
  logMoreButton: { alignItems: 'center', borderTopColor: '#F0E5DD', borderTopWidth: 1, marginTop: 6, paddingTop: 14 },
  logMoreText: { color: '#8A6450', fontSize: 13, fontWeight: '800' },
  settingsCard: { backgroundColor: '#FFFFFF', borderColor: '#E9D9CD', borderRadius: 22, borderWidth: 1, overflow: 'hidden' },
  settingRow: { alignItems: 'center', borderBottomColor: '#F0E5DD', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 54, paddingHorizontal: 16 },
  settingLabel: { color: '#59483D', fontSize: 14, fontWeight: '700' },
  settingValue: { color: '#A08D80', fontSize: 12, maxWidth: '55%' },
  message: { color: '#805844', fontSize: 13, marginTop: 14, textAlign: 'center' },
  signOutButton: { alignItems: 'center', borderColor: '#DFC9B9', borderRadius: 16, borderWidth: 1, justifyContent: 'center', marginTop: 24, minHeight: 52 },
  signOutText: { color: '#8A6450', fontSize: 14, fontWeight: '800' },
  rewardOverlay: { alignItems: 'center', backgroundColor: 'rgba(73,61,52,.38)', flex: 1, justifyContent: 'center', padding: 24 },
  rewardCard: { alignItems: 'center', backgroundColor: '#FFF9F1', borderColor: '#F3C8D0', borderRadius: 28, borderWidth: 2, maxWidth: 320, padding: 26, width: '100%' },
  rewardEmoji: { fontSize: 58 },
  rewardTitle: { color: '#6B3D3D', fontSize: 20, fontWeight: '900', marginTop: 10, textAlign: 'center' },
  rewardSubtitle: { color: '#9A6A6A', fontSize: 13, lineHeight: 19, marginTop: 7, textAlign: 'center' },
  rewardButton: { alignItems: 'center', backgroundColor: '#D95C73', borderRadius: 15, justifyContent: 'center', marginTop: 20, minHeight: 48, paddingHorizontal: 24 },
  rewardButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
});
