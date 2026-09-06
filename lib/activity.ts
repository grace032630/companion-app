import { supabase } from './supabase';

export type TaskCompletion = { id: number; task: string; completed_at: string };

export type ActivitySummary = {
  checkedInToday: boolean;
  streak: number;
  todayCompleted: number;
  weekCompleted: number;
  recent: TaskCompletion[];
};

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function checkInToday(userId: string) {
  return supabase.from('daily_checkins').upsert(
    { user_id: userId, checkin_date: toDateKey(new Date()) },
    { onConflict: 'user_id,checkin_date' },
  );
}

export async function recordTaskCompletion(userId: string, task: string) {
  return supabase.from('task_completions').insert({ user_id: userId, task });
}

export async function fetchActivitySummary(userId: string): Promise<ActivitySummary> {
  const now = new Date();
  const todayKey = toDateKey(now);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  const weekday = (startOfWeek.getDay() + 6) % 7;
  startOfWeek.setDate(startOfWeek.getDate() - weekday);

  const [checkinsResult, completionsResult] = await Promise.all([
    supabase
      .from('daily_checkins')
      .select('checkin_date')
      .eq('user_id', userId)
      .order('checkin_date', { ascending: false })
      .limit(60),
    supabase
      .from('task_completions')
      .select('id,task,completed_at')
      .eq('user_id', userId)
      .gte('completed_at', startOfWeek.toISOString())
      .order('completed_at', { ascending: false })
      .limit(50),
  ]);

  const checkins = (checkinsResult.data ?? []) as { checkin_date: string }[];
  const completions = (completionsResult.data ?? []) as TaskCompletion[];
  const checkinSet = new Set(checkins.map((item) => item.checkin_date));

  let streak = 0;
  const cursor = new Date(startOfToday);
  while (checkinSet.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const todayCompleted = completions.filter((item) => new Date(item.completed_at) >= startOfToday).length;

  return {
    checkedInToday: checkinSet.has(todayKey),
    streak,
    todayCompleted,
    weekCompleted: completions.length,
    recent: completions.slice(0, 5),
  };
}

export async function fetchActivityLogPage(userId: string, page = 0, pageSize = 30) {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const { data, error } = await supabase
    .from('task_completions')
    .select('id,task,completed_at')
    .eq('user_id', userId)
    .order('completed_at', { ascending: false })
    .range(from, to);

  if (error) throw error;
  return (data ?? []) as TaskCompletion[];
}
