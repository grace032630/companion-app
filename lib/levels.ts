export const TASKS_PER_LEVEL = 20;

const TITLES = [
  '還在醞釀',
  '開始動了',
  '行動派',
  '穩定施工中',
  '拖延退散',
  '施工隊長',
  '超級行動派',
  '任務終結者',
  '行動大師',
  '傳說中的執行者',
  '不可能拖延的人',
] as const;

export function getLevelFromCompletions(totalCompleted: number) {
  return Math.floor(Math.max(0, totalCompleted) / TASKS_PER_LEVEL) + 1;
}

export function getTitleForLevel(level: number) {
  const normalizedLevel = Math.max(1, Math.floor(level));
  const titleIndex = Math.min(Math.floor(normalizedLevel / 10), TITLES.length - 1);
  return TITLES[titleIndex];
}

export function getLevelProgress(totalCompleted: number) {
  const normalizedTotal = Math.max(0, Math.floor(totalCompleted));
  const level = getLevelFromCompletions(normalizedTotal);
  const completedInLevel = normalizedTotal % TASKS_PER_LEVEL;
  const remaining = TASKS_PER_LEVEL - completedInLevel;

  return {
    level,
    title: getTitleForLevel(level),
    totalCompleted: normalizedTotal,
    completedInLevel,
    remaining,
    progress: completedInLevel / TASKS_PER_LEVEL,
  };
}
