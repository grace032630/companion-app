import type { AppLanguage } from './profile';

export const LANGUAGE_OPTIONS: { id: AppLanguage; label: string }[] = [
  { id: 'zh-TW', label: '繁體中文' },
  { id: 'zh-CN', label: '简体中文' },
  { id: 'en', label: 'English' },
  { id: 'ja', label: '日本語' },
  { id: 'ko', label: '한국어' },
];

const translations = {
  'zh-TW': { help: '幫我', done: '完成任務', push: '推你一把', punch: '揍一下', dailyQuote: '每日一句' },
  'zh-CN': { help: '帮我', done: '完成任务', push: '推你一把', punch: '揍一下', dailyQuote: '每日一句' },
  en: { help: 'Help me', done: 'Done', push: 'Give a push', punch: 'Bonk', dailyQuote: 'Daily status' },
  ja: { help: '助けて', done: '完了', push: 'ひと押し', punch: '喝を入れる', dailyQuote: '今日のひとこと' },
  ko: { help: '도와줘', done: '완료', push: '한번 밀어주기', punch: '정신 차리게 한방', dailyQuote: '오늘의 한마디' },
} as const;

export type TranslationKey = keyof typeof translations['zh-TW'];
export function t(language: AppLanguage, key: TranslationKey): string {
  return translations[language]?.[key] ?? translations['zh-TW'][key];
}
