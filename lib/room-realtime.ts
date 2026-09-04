import type { RealtimeChannel } from '@supabase/supabase-js';

import type { ConstructionActionId, CrewMember } from '../types/crew';
import { supabase } from './supabase';

export type RoomStatus = 'working' | 'help' | 'done';

export type RoomSession = {
  id: string;
  user_id: string;
  name: string;
  animal: string;
  task: string;
  status: RoomStatus;
  action: ConstructionActionId;
  last_seen: string;
};

export type JoinRoomInput = {
  id: string;
  userId: string;
  name: string;
  animal: string;
  task: string;
  status: RoomStatus;
  action: ConstructionActionId;
};

const ACTIVE_WINDOW_MS = 2 * 60 * 1000;

export async function joinRoom(input: JoinRoomInput) {
  return supabase.from('room_sessions').upsert({
    id: input.id,
    user_id: input.userId,
    name: input.name,
    animal: input.animal,
    task: input.task,
    status: input.status,
    action: input.action,
    last_seen: new Date().toISOString(),
  });
}

export async function updateRoomSession(
  id: string,
  userId: string,
  updates: Partial<Pick<RoomSession, 'task' | 'status' | 'action'>>,
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

export async function fetchActiveRoomSessions(userId: string): Promise<RoomSession[]> {
  const cutoff = new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString();
  const { data, error } = await supabase
    .from('room_sessions')
    .select('id,user_id,name,animal,task,status,action,last_seen')
    .neq('user_id', userId)
    .gt('last_seen', cutoff)
    .order('last_seen', { ascending: false })
    .limit(20);

  if (error) throw error;
  return (data ?? []) as RoomSession[];
}

export function subscribeToRoomSessions(onChange: () => void): RealtimeChannel {
  return supabase
    .channel(`room-sessions-${Date.now()}-${Math.random()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'room_sessions' },
      onChange,
    )
    .subscribe();
}

export function roomSessionToCrewMember(session: RoomSession): CrewMember {
  return {
    id: session.id,
    animal: session.animal,
    name: session.name,
    action: session.action,
    isMe: false,
    isNpc: false,
  };
}
