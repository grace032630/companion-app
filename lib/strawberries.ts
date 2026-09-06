import { supabase } from './supabase';

export async function claimDailyStrawberry() {
  const { data, error } = await supabase.rpc('claim_daily_strawberry');
  if (error) throw error;
  return data === true;
}

export async function fetchStrawberryTotal(userId: string) {
  const [dailyResult, giftResult] = await Promise.all([
    supabase
      .from('daily_strawberries')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('friend_strawberry_gifts')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', userId),
  ]);

  if (dailyResult.error) throw dailyResult.error;
  if (giftResult.error) throw giftResult.error;
  return (dailyResult.count ?? 0) + (giftResult.count ?? 0);
}
