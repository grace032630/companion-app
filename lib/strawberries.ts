import { supabase } from './supabase';

// Temporary MVP testing price. Restore to 500 before release.
export const CHARACTER_UNLOCK_PRICE = 10;

export async function claimDailyStrawberry() {
  const { data, error } = await supabase.rpc('claim_daily_strawberry');
  if (error) throw error;
  return data === true;
}

export async function fetchUnlockedCharacters(userId: string) {
  const { data, error } = await supabase
    .from('character_unlocks')
    .select('animal')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((row) => row.animal as string);
}

export async function unlockCharacter(animal: string) {
  const { data, error } = await supabase.rpc('unlock_character', { p_animal: animal });
  if (error) throw error;
  return typeof data === 'number' ? data : Number(data ?? 0);
}

export async function fetchStrawberryTotal(userId: string) {
  const [dailyResult, giftResult, roomPickupResult, spentResult] = await Promise.all([
    supabase
      .from('daily_strawberries')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('friend_strawberry_gifts')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', userId),
    supabase
      .from('strawberry_pickups')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('character_unlocks')
      .select('price_paid')
      .eq('user_id', userId),
  ]);

  if (dailyResult.error) throw dailyResult.error;
  if (giftResult.error) throw giftResult.error;
  if (roomPickupResult.error) throw roomPickupResult.error;
  if (spentResult.error) throw spentResult.error;

  const spent = (spentResult.data ?? []).reduce((sum, row) => sum + Number(row.price_paid ?? 0), 0);
  const earned = (dailyResult.count ?? 0) + (giftResult.count ?? 0) + (roomPickupResult.count ?? 0);
  return Math.max(0, earned - spent);
}
