import { supabase } from './supabase';

const APP_TIME_ZONE = 'Asia/Taipei';
const APP_UTC_OFFSET = '+08:00';

export type TaskCompletion = { id: number; task: string; completed_at: string };

export type ActivitySummary = {
  checkedInToday: boolean;
  streak: number;
  todayCompleted: number;
  weekCompleted: number;
  recent: TaskCompletion[];
};

function toDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

function addDays(dateKey: string, amount: number) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function appDayStart(dateKey: string) {
  return new Date(`${dateKey}T00:00:00${APP_UTC_OFFSET}`);
}

export async function checkInToday() {
  return supabase.rpc('check_in_today');
}

export async function recordTaskCompletion(roomSessionId: string) {
  return supabase.rpc('record_room_task_completion', {
    p_room_session_id: roomSessionId,
  });
}

export async function fetchActivitySummary(userId: string): Promise<ActivitySummary> {
  const now = new Date();
  const todayKey = toDateKey(now);
  const startOfToday = appDayStart(todayKey);
  const startOfTomorrow = appDayStart(addDays(todayKey, 1));
  const weekday = (new Date(`${todayKey}T12:00:00Z`).getUTCDay() + 6) % 7;
  const startOfWeek = appDayStart(addDays(todayKey, -weekday));

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
  let cursorKey = todayKey;
  while (checkinSet.has(cursorKey)) {
    streak += 1;
    cursorKey = addDays(cursorKey, -1);
  }

  const todayCompleted = completions.filter((item) => {
    const completedAt = new Date(item.completed_at);
    return completedAt >= startOfToday && completedAt < startOfTomorrow;
  }).length;

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
