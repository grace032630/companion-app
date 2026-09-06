import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { useAuth } from '../lib/auth';
import {
  acceptFriendRequest,
  fetchFriends,
  fetchMyFriendId,
  fetchPendingFriendRequests,
  friendErrorMessage,
  giftFriendStrawberry,
  rejectFriendRequest,
  remindFriend,
  sendFriendRequest,
  type Friend,
  type PendingFriendRequest,
} from '../lib/friends';

export default function FriendsScreen() {
  const { session } = useAuth();
  const [friendId, setFriendId] = useState('');
  const [friendIdInput, setFriendIdInput] = useState('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingFriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [friendModalOpen, setFriendModalOpen] = useState(false);
  const [action, setAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadFriends = async () => {
    if (!session?.user.id) return;
    setLoading(true);
    try {
      const [nextFriendId, nextRequests, nextFriends] = await Promise.all([
        fetchMyFriendId(),
        fetchPendingFriendRequests(),
        fetchFriends(),
      ]);
      setFriendId(nextFriendId);
      setPendingRequests(nextRequests);
      setFriends(nextFriends);
    } catch (error) {
      setMessage(friendErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFriends();
  }, [session?.user.id]);

  const handleCopyFriendId = async () => {
    if (!friendId) return;
    await Clipboard.setStringAsync(friendId);
    setMessage('好友 ID 複製好啦！');
  };

  const handleSendFriendRequest = async () => {
    const normalizedId = friendIdInput.trim().toUpperCase();
    if (!/^[A-HJ-NP-Z2-9]{8}$/.test(normalizedId)) {
      setMessage('好友 ID 是 8 碼大寫英數字唷～');
      return;
    }

    setAction('send');
    setMessage(null);
    try {
      await sendFriendRequest(normalizedId);
      setFriendIdInput('');
      setFriendModalOpen(false);
      setMessage('邀請送出去啦！');
      await loadFriends();
    } catch (error) {
      setMessage(friendErrorMessage(error));
    } finally {
      setAction(null);
    }
  };

  const handleFriendRequest = async (requestId: string, nextAction: 'accept' | 'reject') => {
    setAction(`${nextAction}:${requestId}`);
    setMessage(null);
    try {
      if (nextAction === 'accept') {
        await acceptFriendRequest(requestId);
        setMessage('變成好友啦！一起施工吧 ✨');
      } else {
        await rejectFriendRequest(requestId);
        setMessage('已經幫你婉拒邀請了～');
      }
      await loadFriends();
    } catch (error) {
      setMessage(friendErrorMessage(error));
    } finally {
      setAction(null);
    }
  };

  const handleRemindFriend = async (friend: Friend) => {
    setAction(`remind:${friend.userId}`);
    setMessage(null);
    try {
      const result = await remindFriend(friend.userId);
      if (result === 'sent') setMessage('提醒他了 🔔');
      if (result === 'already_reminded') setMessage('今天已經提醒過他了～');
      if (result === 'already_checked_in') setMessage('他今天已經打卡了！');
    } catch (error) {
      setMessage(friendErrorMessage(error));
    } finally {
      setAction(null);
    }
  };

  const handleGiftStrawberry = async (friend: Friend) => {
    setAction(`gift:${friend.userId}`);
    setMessage(null);
    try {
      const result = await giftFriendStrawberry(friend.userId);
      setMessage(result === 'sent' ? '🍓 草莓送到啦！' : '今天已經送過草莓啦～');
    } catch (error) {
      setMessage(friendErrorMessage(error));
    } finally {
      setAction(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.pageShell}>
          <View pointerEvents="none" style={styles.pageDecor}>
            <Text style={styles.sparkRowA}>✦   ✧   ✦   ✧   ✦   ✧</Text>
            <Text style={styles.sparkRowB}>✧   ✦   ✧   ✦   ✧   ✦</Text>
            <Text style={styles.sparkRowC}>✦   ✧   ✦   ✧   ✦   ✧</Text>
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
              <Text style={styles.headerTitle}>好友</Text>
              <View style={styles.headerSpacer} />
            </View>

            <View style={styles.introCard}>
              <Text style={styles.introEmoji}>🐾</Text>
              <Text style={styles.introTitle}>一起施工更有力氣</Text>
              <Text style={styles.introCopy}>找朋友互相提醒，也可以送一顆小草莓打氣。</Text>
            </View>

            <View style={styles.friendIdCard}>
              <View style={styles.friendIdCopy}>
                <Text style={styles.friendIdLabel}>我的好友 ID</Text>
                <Text selectable style={styles.friendIdValue}>{friendId || '--------'}</Text>
              </View>
              <Pressable disabled={!friendId} onPress={handleCopyFriendId} style={styles.smallButton}>
                <Text style={styles.smallButtonText}>複製</Text>
              </Pressable>
            </View>

            <Pressable onPress={() => setFriendModalOpen(true)} style={styles.addButton}>
              <Text style={styles.addButtonText}>＋ 加入好友</Text>
            </Pressable>

            {pendingRequests.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>等你回覆的邀請</Text>
                {pendingRequests.map((request) => {
                  const accepting = action === `accept:${request.requestId}`;
                  const rejecting = action === `reject:${request.requestId}`;
                  return (
                    <View key={request.requestId} style={styles.pendingCard}>
                      <AnimalCharacter animal={request.animal} size="small" state="idle" />
                      <Text numberOfLines={2} style={styles.pendingCopy}>
                        <Text style={styles.pendingName}>{request.nickname}</Text> 想加你為好友
                      </Text>
                      <Pressable
                        disabled={Boolean(action)}
                        onPress={() => void handleFriendRequest(request.requestId, 'accept')}
                        style={styles.acceptButton}
                      >
                        {accepting ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.acceptText}>接受</Text>}
                      </Pressable>
                      <Pressable
                        disabled={Boolean(action)}
                        onPress={() => void handleFriendRequest(request.requestId, 'reject')}
                        style={styles.rejectButton}
                      >
                        {rejecting ? <ActivityIndicator color="#8A6450" size="small" /> : <Text style={styles.rejectText}>拒絕</Text>}
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            ) : null}

            <View style={styles.sectionHeadingRow}>
              <Text style={styles.sectionTitle}>我的好友</Text>
              <Text style={styles.friendCount}>{friends.length} 位</Text>
            </View>

            <View style={styles.friendList}>
              {loading ? (
                <ActivityIndicator color="#A86F4D" />
              ) : friends.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyEmoji}>🌱</Text>
                  <Text style={styles.emptyText}>好友還在路上，分享你的好友 ID 邀請他們吧～</Text>
                </View>
              ) : (
                friends.map((friend) => (
                  <View key={friend.userId} style={styles.friendCard}>
                    <View style={styles.friendCharacter}>
                      <AnimalCharacter animal={friend.animal} size="regular" state="idle" />
                    </View>
                    <View style={styles.friendDetails}>
                      <Text numberOfLines={1} style={styles.friendName}>{friend.nickname}</Text>
                      <Text style={styles.friendStreak}>🔥 連續施工 {friend.streak} 天</Text>
                      <View style={styles.friendActions}>
                        <Pressable
                          disabled={Boolean(action)}
                          onPress={() => void handleRemindFriend(friend)}
                          style={[styles.actionButton, friend.checkedInToday && styles.actionButtonMuted]}
                        >
                          {action === `remind:${friend.userId}` ? (
                            <ActivityIndicator color="#805844" size="small" />
                          ) : (
                            <Text style={styles.actionText}>提醒打卡</Text>
                          )}
                        </Pressable>
                        <Pressable
                          disabled={Boolean(action)}
                          onPress={() => void handleGiftStrawberry(friend)}
                          style={[styles.actionButton, styles.giftButton]}
                        >
                          {action === `gift:${friend.userId}` ? (
                            <ActivityIndicator color="#A54F61" size="small" />
                          ) : (
                            <Text style={[styles.actionText, styles.giftText]}>送草莓 🍓</Text>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>

            {message ? <Text style={styles.message}>{message}</Text> : null}
          </ScrollView>

          <Modal
            animationType="fade"
            onRequestClose={() => setFriendModalOpen(false)}
            transparent
            visible={friendModalOpen}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalCard}>
                <Text style={styles.modalEmoji}>🐾</Text>
                <Text style={styles.modalTitle}>加入好友</Text>
                <Text style={styles.modalSubtitle}>輸入對方的 8 碼好友 ID</Text>
                <TextInput
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={8}
                  onChangeText={(value) => setFriendIdInput(value.toUpperCase())}
                  onSubmitEditing={() => void handleSendFriendRequest()}
                  placeholder="輸入好友 ID"
                  placeholderTextColor="#B2A094"
                  returnKeyType="send"
                  style={styles.friendIdInput}
                  value={friendIdInput}
                />
                <Pressable disabled={action === 'send'} onPress={() => void handleSendFriendRequest()} style={styles.modalSubmit}>
                  {action === 'send' ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.modalSubmitText}>送出邀請</Text>}
                </Pressable>
                <Pressable disabled={action === 'send'} onPress={() => setFriendModalOpen(false)} style={styles.modalCancel}>
                  <Text style={styles.modalCancelText}>先不要</Text>
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
  pageDecor: { bottom: 0, left: 0, overflow: 'hidden', position: 'absolute', right: 0, top: 0 },
  sparkRowA: { color: 'rgba(198,139,88,0.42)', fontSize: 19, left: -20, letterSpacing: 8, position: 'absolute', top: 120, transform: [{ rotate: '-18deg' }] },
  sparkRowB: { color: 'rgba(198,139,88,0.34)', fontSize: 18, letterSpacing: 8, position: 'absolute', right: -28, top: 450, transform: [{ rotate: '-18deg' }] },
  sparkRowC: { color: 'rgba(198,139,88,0.28)', fontSize: 19, left: -18, letterSpacing: 8, position: 'absolute', top: 820, transform: [{ rotate: '-18deg' }] },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  backButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  backText: { color: '#6C5648', fontSize: 38, lineHeight: 40 },
  headerTitle: { color: '#493D34', fontSize: 20, fontWeight: '900' },
  headerSpacer: { width: 44 },
  introCard: { alignItems: 'center', backgroundColor: '#F1D9BE', borderColor: '#D5AF87', borderRadius: 24, borderWidth: 1, marginTop: 14, padding: 18 },
  introEmoji: { fontSize: 34 },
  introTitle: { color: '#5A4538', fontSize: 17, fontWeight: '900', marginTop: 5 },
  introCopy: { color: '#927565', fontSize: 12, lineHeight: 18, marginTop: 5, textAlign: 'center' },
  friendIdCard: { alignItems: 'center', backgroundColor: '#FFFDF9', borderColor: '#E3D2C3', borderRadius: 20, borderWidth: 1, flexDirection: 'row', marginTop: 14, padding: 15 },
  friendIdCopy: { flex: 1 },
  friendIdLabel: { color: '#927565', fontSize: 11, fontWeight: '700' },
  friendIdValue: { color: '#4D3F36', fontSize: 21, fontWeight: '900', letterSpacing: 2, marginTop: 4 },
  smallButton: { backgroundColor: '#F5E8DD', borderRadius: 12, paddingHorizontal: 15, paddingVertical: 10 },
  smallButtonText: { color: '#805844', fontSize: 12, fontWeight: '900' },
  addButton: { alignItems: 'center', backgroundColor: '#A86F4D', borderRadius: 15, justifyContent: 'center', marginTop: 10, minHeight: 48 },
  addButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  section: { marginTop: 24 },
  sectionHeadingRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 26 },
  sectionTitle: { color: '#5A483C', fontSize: 17, fontWeight: '900', marginBottom: 10 },
  friendCount: { color: '#927565', fontSize: 12, fontWeight: '800', marginBottom: 10 },
  pendingCard: { alignItems: 'center', backgroundColor: '#FFF4E8', borderColor: '#EACFB5', borderRadius: 18, borderWidth: 1, flexDirection: 'row', marginBottom: 8, minHeight: 68, padding: 10 },
  pendingCopy: { color: '#765D4D', flex: 1, fontSize: 12, lineHeight: 18, marginHorizontal: 7 },
  pendingName: { color: '#4D3F36', fontWeight: '900' },
  acceptButton: { alignItems: 'center', backgroundColor: '#A86F4D', borderRadius: 11, justifyContent: 'center', minHeight: 36, minWidth: 48, paddingHorizontal: 10 },
  acceptText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  rejectButton: { alignItems: 'center', borderColor: '#D9C2B2', borderRadius: 11, borderWidth: 1, justifyContent: 'center', marginLeft: 6, minHeight: 36, minWidth: 48, paddingHorizontal: 10 },
  rejectText: { color: '#8A6450', fontSize: 11, fontWeight: '800' },
  friendList: { minHeight: 80 },
  friendCard: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E9D9CD', borderRadius: 20, borderWidth: 1, flexDirection: 'row', marginBottom: 9, padding: 13 },
  friendCharacter: { alignItems: 'center', backgroundColor: '#FFF7EF', borderRadius: 28, height: 58, justifyContent: 'center', width: 58 },
  friendDetails: { flex: 1, marginLeft: 12 },
  friendName: { color: '#4D3F36', fontSize: 15, fontWeight: '900' },
  friendStreak: { color: '#927565', fontSize: 11, marginTop: 3 },
  friendActions: { flexDirection: 'row', gap: 7, marginTop: 9 },
  actionButton: { alignItems: 'center', backgroundColor: '#F5E8DD', borderRadius: 11, justifyContent: 'center', minHeight: 35, minWidth: 88, paddingHorizontal: 11 },
  actionButtonMuted: { backgroundColor: '#F1EEE9' },
  actionText: { color: '#805844', fontSize: 11, fontWeight: '900' },
  giftButton: { backgroundColor: '#FFE8EC' },
  giftText: { color: '#A54F61' },
  emptyCard: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E9D9CD', borderRadius: 20, borderWidth: 1, padding: 22 },
  emptyEmoji: { fontSize: 30 },
  emptyText: { color: '#9C897B', fontSize: 13, lineHeight: 20, marginTop: 8, textAlign: 'center' },
  message: { color: '#805844', fontSize: 13, marginTop: 8, textAlign: 'center' },
  modalOverlay: { alignItems: 'center', backgroundColor: 'rgba(73,61,52,.45)', flex: 1, justifyContent: 'center', padding: 24 },
  modalCard: { alignItems: 'center', backgroundColor: '#FFF9F1', borderColor: '#E4CDB8', borderRadius: 28, borderWidth: 2, maxWidth: 340, padding: 24, width: '100%' },
  modalEmoji: { fontSize: 42 },
  modalTitle: { color: '#5A4538', fontSize: 20, fontWeight: '900', marginTop: 8 },
  modalSubtitle: { color: '#927565', fontSize: 12, marginTop: 6 },
  friendIdInput: { backgroundColor: '#FFFFFF', borderColor: '#DFC9B9', borderRadius: 15, borderWidth: 1, color: '#493D34', fontSize: 20, fontWeight: '900', letterSpacing: 3, marginTop: 18, minHeight: 54, paddingHorizontal: 15, textAlign: 'center', width: '100%' },
  modalSubmit: { alignItems: 'center', backgroundColor: '#A86F4D', borderRadius: 15, justifyContent: 'center', marginTop: 14, minHeight: 48, width: '100%' },
  modalSubmitText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  modalCancel: { marginTop: 10, padding: 8 },
  modalCancelText: { color: '#927565', fontSize: 13, fontWeight: '700' },
});
