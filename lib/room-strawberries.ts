import { supabase } from './supabase';

export type RoomStrawberry = {
  id: string;
  room_id: string;
  x_percent: number;
  y_percent: number;
  source: 'entry' | 'completion';
  spawned_at: string;
  claimed_by: string | null;
};

type RoomStrawberryRow = RoomStrawberry;

export async function ensureRoomStrawberries() {
  const { data, error } = await supabase.rpc('ensure_room_strawberries');
  if (error) throw error;
  return data === true;
}

export async function fetchRoomStrawberries(roomId: string) {
  const { data, error } = await supabase
    .from('room_strawberries')
    .select('id,room_id,x_percent,y_percent,source,spawned_at,claimed_by')
    .eq('room_id', roomId)
    .is('claimed_by', null)
    .order('spawned_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as RoomStrawberryRow[];
}

export async function claimRoomStrawberry(strawberryId: string) {
  const { data, error } = await supabase.rpc('claim_room_strawberry', {
    p_strawberry_id: strawberryId,
  });
  if (error) throw error;
  return data === true;
}

export function subscribeToRoomStrawberries(roomId: string, onChange: () => void) {
  return supabase
    .channel(`room-strawberries:${roomId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'room_strawberries', filter: `room_id=eq.${roomId}` },
      () => onChange(),
    )
    .subscribe();
}
