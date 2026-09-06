import { supabase } from './supabase';

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { dateKey: toDateKey(now), start, end };
}

export async function claimDailyStrawberry() {
  const { dateKey, start, end } = todayBounds();
  const { data, error } = await supabase.rpc('claim_daily_strawberry', {
    p_reward_date: dateKey,
    p_start: start.toISOString(),
    p_end: end.toISOString(),
  });
  if (error) throw error;
  return Boolean(data);
}

export async function fetchStrawberryTotal(userId: string) {
  const { count, error } = await supabase
    .from('daily_strawberries')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) throw error;
  return count ?? 0;
}
