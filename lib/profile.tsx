import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useState } from 'react';

import { useAuth } from './auth';
import { supabase } from './supabase';

export type AppLanguage = 'zh-TW' | 'zh-CN' | 'en' | 'ja' | 'ko';

export type Profile = {
  user_id: string;
  nickname: string;
  animal: string;
  quote: string | null;
  language: AppLanguage;
};

type ProfileContextValue = {
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  saveProfile: (input: { nickname: string; animal: string; quote?: string | null; language?: AppLanguage }) => Promise<{ error: string | null }>;
};

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

export function ProfileProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshProfile = useCallback(async () => {
    const userId = session?.user.id;
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id,nickname,animal,quote,language')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      setProfile(null);
    } else {
      const row = data as Omit<Profile, 'language'> & { language?: AppLanguage | null } | null;
      setProfile(row ? { ...row, language: row.language ?? 'zh-TW' } : null);
    }
    setLoading(false);
  }, [session?.user.id]);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const saveProfile = useCallback(
    async ({ nickname, animal, quote, language }: { nickname: string; animal: string; quote?: string | null; language?: AppLanguage }) => {
      const userId = session?.user.id;
      if (!userId) return { error: '尚未登入' };

      const payload: Record<string, unknown> = {
        user_id: userId,
        nickname: nickname.trim(),
        animal,
        updated_at: new Date().toISOString(),
      };
      if (quote !== undefined) payload.quote = quote?.trim() || null;
      if (language !== undefined) payload.language = language;

      const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'user_id' });
      if (error) return { error: error.message };
      await refreshProfile();
      return { error: null };
    },
    [refreshProfile, session?.user.id],
  );

  return (
    <ProfileContext.Provider value={{ profile, loading, refreshProfile, saveProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextValue {
  const context = useContext(ProfileContext);
  if (!context) throw new Error('useProfile must be used inside a ProfileProvider');
  return context;
}
