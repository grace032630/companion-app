import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

export default function HomeScreen() {
  const { session } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    setErrorMessage(null);

    const { error } = await supabase.auth.signOut();

    if (error) {
      setErrorMessage(error.message);
      setIsSigningOut(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.brand}>Companion</Text>
            {session?.user.email && <Text style={styles.email}>{session.user.email}</Text>}
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>🐻</Text>
          </View>
        </View>

        <View style={styles.promptCard}>
          <Text style={styles.overline}>LET’S START TOGETHER</Text>
          <Text style={styles.prompt}>今天有什麼事，一個人不太想做？</Text>
          <Text style={styles.helper}>先不用完成，和小夥伴一起開始就好。</Text>
          <View style={styles.companions}>
            <Text style={styles.companion}>🦊</Text>
            <Text style={styles.companion}>🐰</Text>
            <Text style={styles.companion}>🐻</Text>
          </View>
        </View>

        <View style={styles.footer}>
          {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
          <Pressable
            accessibilityRole="button"
            disabled={isSigningOut}
            onPress={handleSignOut}
            style={({ pressed }) => [styles.signOutButton, pressed && styles.buttonPressed]}>
            {isSigningOut ? (
              <ActivityIndicator color="#7C5D4B" />
            ) : (
              <Text style={styles.signOutText}>Sign out</Text>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FFF9F1',
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  brand: {
    color: '#493D34',
    fontSize: 24,
    fontWeight: '700',
  },
  email: {
    color: '#8A7A6E',
    fontSize: 13,
    marginTop: 4,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#F4E1CF',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  avatarText: {
    fontSize: 27,
  },
  promptCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#F0DED0',
    borderRadius: 28,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 48,
    minHeight: 330,
    padding: 28,
    shadowColor: '#795E4B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
  overline: {
    color: '#A36E50',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    marginBottom: 16,
  },
  prompt: {
    color: '#493D34',
    fontSize: 29,
    fontWeight: '700',
    lineHeight: 42,
  },
  helper: {
    color: '#8A7A6E',
    fontSize: 15,
    lineHeight: 24,
    marginTop: 14,
  },
  companions: {
    flexDirection: 'row',
    marginTop: 28,
  },
  companion: {
    fontSize: 32,
    marginRight: 10,
  },
  footer: {
    marginTop: 'auto',
  },
  signOutButton: {
    alignItems: 'center',
    borderColor: '#DCC7B6',
    borderRadius: 15,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
  },
  signOutText: {
    color: '#7C5D4B',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonPressed: {
    backgroundColor: '#F7ECE2',
  },
  errorText: {
    color: '#9B4F3B',
    fontSize: 13,
    marginBottom: 10,
    textAlign: 'center',
  },
});
