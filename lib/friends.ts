import { supabase } from './supabase';

export type PendingFriendRequest = {
  requestId: string;
  userId: string;
  nickname: string;
  animal: string;
  createdAt: string;
};

export type Friend = {
  userId: string;
  nickname: string;
  animal: string;
  publicFriendId: string;
  streak: number;
  checkedInToday: boolean;
};

export type FriendReminderResult = 'sent' | 'already_checked_in' | 'already_reminded';
export type FriendStrawberryGiftResult = 'sent' | 'already_gifted';

// TODO(friends-v2): add dedicated RPCs for removing and blocking friends.

type PendingFriendRequestRow = {
  request_id: string;
  user_id: string;
  nickname: string;
  animal: string;
  created_at: string;
};

type FriendRow = {
  user_id: string;
  nickname: string;
  animal: string;
  public_friend_id: string;
  streak: number;
  checked_in_today: boolean;
};

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function throwIfError(error: { message: string } | null) {
  if (error) throw error;
}

export async function fetchMyFriendId() {
  const { data, error } = await supabase.rpc('fetch_my_friend_id');
  throwIfError(error);
  return data as string;
}

export async function sendFriendRequest(friendId: string) {
  const normalizedFriendId = friendId.trim().toUpperCase();
  const { data, error } = await supabase.rpc('send_friend_request', {
    p_friend_id: normalizedFriendId,
  });
  throwIfError(error);
  return data as string;
}

export async function fetchPendingFriendRequests(): Promise<PendingFriendRequest[]> {
  const { data, error } = await supabase.rpc('fetch_pending_friend_requests');
  throwIfError(error);

  return ((data ?? []) as PendingFriendRequestRow[]).map((row) => ({
    requestId: row.request_id,
    userId: row.user_id,
    nickname: row.nickname,
    animal: row.animal,
    createdAt: row.created_at,
  }));
}

export async function acceptFriendRequest(requestId: string) {
  const { data, error } = await supabase.rpc('accept_friend_request', {
    p_request_id: requestId,
  });
  throwIfError(error);
  return data as boolean;
}

export async function rejectFriendRequest(requestId: string) {
  const { data, error } = await supabase.rpc('reject_friend_request', {
    p_request_id: requestId,
  });
  throwIfError(error);
  return data as boolean;
}

export async function fetchFriends(): Promise<Friend[]> {
  const { data, error } = await supabase.rpc('fetch_friends', {
    p_local_date: localDateKey(),
  });
  throwIfError(error);

  return ((data ?? []) as FriendRow[]).map((row) => ({
    userId: row.user_id,
    nickname: row.nickname,
    animal: row.animal,
    publicFriendId: row.public_friend_id,
    streak: Number(row.streak),
    checkedInToday: row.checked_in_today,
  }));
}

export async function remindFriend(friendUserId: string): Promise<FriendReminderResult> {
  const { data, error } = await supabase.rpc('remind_friend', {
    p_friend_user_id: friendUserId,
    p_reminder_date: localDateKey(),
  });
  throwIfError(error);
  return data as FriendReminderResult;
}

export async function giftFriendStrawberry(friendUserId: string): Promise<FriendStrawberryGiftResult> {
  const { data, error } = await supabase.rpc('gift_friend_strawberry', {
    p_friend_user_id: friendUserId,
    p_gift_date: localDateKey(),
  });
  throwIfError(error);
  return data as FriendStrawberryGiftResult;
}

export function friendErrorMessage(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'object' && error && 'message' in error
      ? String(error.message)
      : String(error);

  if (message.includes('FRIEND_ID_NOT_FOUND')) return '找不到這個好友 ID，再確認一下～';
  if (message.includes('CANNOT_ADD_SELF')) return '這是你自己的好友 ID 唷～';
  if (message.includes('FRIENDSHIP_ALREADY_EXISTS')) return '你們已經有邀請或是好友啦！';
  if (message.includes('NOT_FRIENDS')) return '要先成為好友才能這麼做唷～';
  if (message.includes('FRIEND_REQUEST_NOT_PENDING')) return '這個邀請已經處理過了～';
  if (message.includes('NOT_AUTHENTICATED')) return '登入狀態過期了，請重新登入。';
  return '剛剛沒有成功，再試一次好嗎？';
}
