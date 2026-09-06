import type { RealtimeChannel } from '@supabase/supabase-js';

import type { ConstructionActionId, CrewMember } from '../types/crew';
import { supabase } from './supabase';

export type RoomStatus = 'working' | 'help' | 'done';
export type SupportKind = 'push' | 'punch';

export type RoomSession = {
  id: string;
  room_id: string;
  user_id: string;
  name: string;
  animal: string;
  task: string;
  status: RoomStatus;
  action: ConstructionActionId;
  help_request_id: string | null;
  last_seen: string;
  quote?: string | null;
};

export type SupportEvent = {
  id: string;
  room_id: string;
  request_id: string;
  target_user_id: string;
  actor_user_id: string;
  actor_name: string;
  actor_animal: string;
  kind: SupportKind;
  created_at: string;
};

export type JoinRoomInput = {
  id: string;
  roomId: string;
  userId: string;
  name: string;
  animal: string;
  task: string;
  status: RoomStatus;
  action: ConstructionActionId;
};

const ACTIVE_WINDOW_MS = 2 * 60 * 1000;

export async function assignRoom(maxMembers = 6): Promise<string> {
  const { data, error } = await supabase.rpc('assign_room', { p_max_members: maxMembers });
  if (error) throw error;
  if (!data) throw new Error('找不到可加入的房間');
  return data as string;
}

export async function joinRoom(input: JoinRoomInput) {
  return supabase.from('room_sessions').upsert({
    id: input.id,
    room_id: input.roomId,
    user_id: input.userId,
    name: input.name,
    animal: input.animal,
    task: input.task,
    status: input.status,
    action: input.action,
    help_request_id: null,
    last_seen: new Date().toISOString(),
  });
}

export async function updateRoomSession(
  id: string,
  userId: string,
  updates: Partial<Pick<RoomSession, 'task' | 'status' | 'action' | 'help_request_id'>>,
) {
  return supabase
    .from('room_sessions')
    .update({ ...updates, last_seen: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId);
}

export async function heartbeatRoomSession(id: string, userId: string) {
  return supabase
    .from('room_sessions')
    .update({ last_seen: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId);
}

export async function leaveRoom(id: string, userId: string) {
  return supabase.from('room_sessions').delete().eq('id', id).eq('user_id', userId);
}

export async function fetchActiveRoomSessions(userId: string, roomId: string): Promise<RoomSession[]> {
  const cutoff = new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString();
  const { data, error } = await supabase
    .from('room_sessions')
    .select('id,room_id,user_id,name,animal,task,status,action,help_request_id,last_seen')
    .eq('room_id', roomId)
    .neq('user_id', userId)
    .gt('last_seen', cutoff)
    .order('last_seen', { ascending: false })
    .limit(5);

  if (error) throw error;

  const sessions = (data ?? []) as RoomSession[];
  if (sessions.length === 0) return sessions;

  const userIds = sessions.map((session) => session.user_id);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id,quote')
    .in('user_id', userIds);

  const quoteByUser = new Map<string, string | null>(
    (profiles ?? []).map((profile) => [profile.user_id as string, (profile.quote as string | null) ?? null]),
  );

  return sessions.map((session) => ({
    ...session,
    quote: quoteByUser.get(session.user_id) ?? null,
  }));
}

export function subscribeToRoomSessions(roomId: string, onChange: () => void): RealtimeChannel {
  return supabase
    .channel(`room-${roomId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'room_sessions',
        filter: `room_id=eq.${roomId}`,
      },
      onChange,
    )
    .subscribe();
}

export function subscribeToSupportEvents(
  roomId: string,
  userId: string,
  onEvent: (event: SupportEvent) => void,
): RealtimeChannel {
  return supabase
    .channel(`support-${roomId}-${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'support_events',
        filter: `target_user_id=eq.${userId}`,
      },
      (payload) => {
        const event = payload.new as SupportEvent;
        if (event.room_id === roomId) onEvent(event);
      },
    )
    .subscribe();
}

export async function sendSupportEvent(input: {
  roomId: string;
  requestId: string;
  targetUserId: string;
  kind: SupportKind;
  actorName: string;
  actorAnimal: string;
}) {
  return supabase.rpc('send_support_event', {
    p_room_id: input.roomId,
    p_request_id: input.requestId,
    p_target_user_id: input.targetUserId,
    p_kind: input.kind,
    p_actor_name: input.actorName,
    p_actor_animal: input.actorAnimal,
  });
}

export function roomSessionToCrewMember(session: RoomSession): CrewMember {
  return {
    id: session.id,
    animal: session.animal,
    name: session.name,
    action: session.action,
    isMe: false,
    isNpc: false,
    userId: session.user_id,
    quote: session.quote ?? null,
  };
}
