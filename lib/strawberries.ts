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

/**
 * Give the signed-in user today's strawberry once they have at least one
 * completed task today. This intentionally does not depend on the RPC so
 * existing test accounts can receive today's reward even if they completed
 * their task before the strawberry feature was added.
 */
export async function claimDailyStrawberry() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const userId = authData.user?.id;
  if (!userId) throw new Error('找不到登入帳號，請重新登入後再試');

  const { dateKey, start, end } = todayBounds();

  const { data: existing, error: existingError } = await supabase
    .from('daily_strawberries')
    .select('id')
    .eq('user_id', userId)
    .eq('reward_date', dateKey)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return false;

  const { count: completionCount, error: completionError } = await supabase
    .from('task_completions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('completed_at', start.toISOString())
    .lt('completed_at', end.toISOString());
  if (completionError) throw completionError;
  if (!completionCount) return false;

  const { error: insertError } = await supabase.from('daily_strawberries').insert({
    user_id: userId,
    reward_date: dateKey,
  });

  // If two refreshes race, the unique (user_id, reward_date) constraint wins.
  if (insertError) {
    if (insertError.code === '23505') return false;
    throw insertError;
  }

  return true;
}

export async function fetchStrawberryTotal(userId: string) {
  const { count, error } = await supabase
    .from('daily_strawberries')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) throw error;
  return count ?? 0;
}
