import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../lib/supabase';

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  WebBrowser.maybeCompleteAuthSession();
}

type AuthMethod = 'google' | 'apple' | 'line' | null;
type OAuthProvider = Parameters<typeof supabase.auth.signInWithOAuth>[0]['provider'];

async function createSessionFromUrl(url: string) {
  const { params, errorCode } = QueryParams.getQueryParams(url);

  if (errorCode) {
    throw new Error(params.error_description ?? errorCode);
  }

  const accessToken = params.access_token;
  const refreshToken = params.refresh_token;

  if (!accessToken || !refreshToken) {
    throw new Error('The sign-in response did not include a session. Please try again.');
  }

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) {
    throw error;
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export default function LoginScreen() {
  const [activeMethod, setActiveMethod] = useState<AuthMethod>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isLoading = activeMethod !== null;

  const handleOAuthSignIn = async (
    method: Exclude<AuthMethod, 'apple' | null>,
    provider: OAuthProvider,
  ) => {
    setActiveMethod(method);
    setErrorMessage(null);

    try {
      const redirectTo = makeRedirectUri({ scheme: 'companionapp' });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        throw error;
      }

      if (!data.url) {
        throw new Error(`Unable to open ${method === 'line' ? 'LINE' : 'Google'} sign-in. Please try again.`);
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (result.type === 'success') {
        await createSessionFromUrl(result.url);
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setActiveMethod(null);
    }
  };

  const handleGoogleSignIn = () => handleOAuthSignIn('google', 'google');
  const handleLineSignIn = () => handleOAuthSignIn('line', 'custom:line');

  const handleAppleSignIn = async () => {
    setActiveMethod('apple');
    setErrorMessage(null);

    try {
      if (Platform.OS !== 'ios' || !(await AppleAuthentication.isAvailableAsync())) {
        Alert.alert('Apple Sign In', 'Apple Sign In is available in the iOS app.');
        return;
      }

      const nonce = Crypto.randomUUID();
      const credential = await AppleAuthentication.signInAsync({
        nonce,
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error('Apple did not return an identity token. Please try again.');
      }

      const { error } = await supabase.auth.signInWithIdToken({
        nonce,
        provider: 'apple',
        token: credential.identityToken,
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      if ((error as { code?: string }).code !== 'ERR_REQUEST_CANCELED') {
        setErrorMessage(getErrorMessage(error));
      }
    } finally {
      setActiveMethod(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.glowTop} />
        <View style={styles.glowBottom} />

        <View style={styles.content}>
          <View style={styles.illustration} accessibilityElementsHidden>
            <View style={[styles.animalBubble, styles.foxBubble]}>
              <Text style={styles.animal}>🦊</Text>
            </View>
            <View style={[styles.animalBubble, styles.bearBubble]}>
              <Text style={styles.animalLarge}>🐻</Text>
            </View>
            <View style={[styles.animalBubble, styles.rabbitBubble]}>
              <Text style={styles.animal}>🐰</Text>
            </View>
            <View style={styles.table} />
            <View style={styles.pencil} />
            <View style={styles.notebook}>
              <View style={styles.notebookLine} />
              <View style={[styles.notebookLine, styles.notebookLineShort]} />
            </View>
          </View>

          <View style={styles.headingBlock}>
            <Text style={styles.eyebrow}>YOUR GENTLE STARTING BUDDY</Text>
            <Text style={styles.title}>Companion</Text>
            <Text style={styles.tagline}>「一個人不想開始，就一起開工吧」</Text>
            <Text style={styles.description}>找一隻小夥伴陪你，把「等一下」變成「現在開始」。</Text>
          </View>

          <View style={styles.authCard}>
            <Pressable
              accessibilityRole="button"
              disabled={isLoading}
              onPress={handleGoogleSignIn}
              style={({ pressed }) => [
                styles.authButton,
                styles.googleButton,
                pressed && styles.buttonPressed,
                isLoading && styles.buttonDisabled,
              ]}>
              {activeMethod === 'google' ? (
                <ActivityIndicator color="#493D34" />
              ) : (
                <>
                  <View style={styles.googleIcon}>
                    <Text style={styles.googleIconText}>G</Text>
                  </View>
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </>
              )}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={isLoading}
              onPress={handleLineSignIn}
              style={({ pressed }) => [
                styles.authButton,
                styles.lineButton,
                pressed && styles.buttonPressed,
                isLoading && styles.buttonDisabled,
              ]}>
              {activeMethod === 'line' ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <View style={styles.lineIcon}>
                    <Text style={styles.lineIconText}>LINE</Text>
                  </View>
                  <Text style={styles.lineButtonText}>Continue with LINE</Text>
                </>
              )}
            </Pressable>

            {Platform.OS === 'ios' ? (
              <View
                pointerEvents={isLoading ? 'none' : 'auto'}
                style={[styles.appleButtonWrap, isLoading && styles.buttonDisabled]}>
                <AppleAuthentication.AppleAuthenticationButton
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                  cornerRadius={16}
                  onPress={handleAppleSignIn}
                  style={styles.appleNativeButton}
                />
                {activeMethod === 'apple' && (
                  <View style={styles.appleLoading}>
                    <ActivityIndicator color="#FFFFFF" />
                  </View>
                )}
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                disabled={isLoading}
                onPress={handleAppleSignIn}
                style={({ pressed }) => [
                  styles.authButton,
                  styles.appleFallbackButton,
                  pressed && styles.buttonPressed,
                  isLoading && styles.buttonDisabled,
                ]}>
                <Text style={styles.appleMark}>A</Text>
                <Text style={styles.appleButtonText}>Continue with Apple</Text>
              </Pressable>
            )}

            {errorMessage && (
              <View style={styles.errorBox} accessibilityRole="alert">
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            <Text style={styles.terms}>登入即表示你同意以溫柔的步調，陪自己開始。</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#FFF9F1', flex: 1 },
  scrollContent: { flexGrow: 1, overflow: 'hidden', paddingHorizontal: 24, paddingVertical: 20 },
  glowTop: { backgroundColor: '#F9DDC5', borderRadius: 150, height: 260, opacity: 0.46, position: 'absolute', right: -100, top: -100, width: 260 },
  glowBottom: { backgroundColor: '#DCE8D4', borderRadius: 120, bottom: -90, height: 220, left: -100, opacity: 0.52, position: 'absolute', width: 220 },
  content: { alignSelf: 'center', flex: 1, justifyContent: 'center', maxWidth: 430, paddingVertical: 16, width: '100%' },
  illustration: { alignSelf: 'center', height: 190, marginBottom: 24, position: 'relative', width: 292 },
  animalBubble: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#F2DDCB', borderRadius: 42, borderWidth: 2, justifyContent: 'center', position: 'absolute', shadowColor: '#9C7961', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 12 },
  foxBubble: { height: 68, left: 6, top: 44, transform: [{ rotate: '-7deg' }], width: 68 },
  bearBubble: { height: 94, left: 99, top: 4, width: 94 },
  rabbitBubble: { height: 68, right: 7, top: 48, transform: [{ rotate: '7deg' }], width: 68 },
  animal: { fontSize: 38 },
  animalLarge: { fontSize: 52 },
  table: { backgroundColor: '#E6C5A8', borderRadius: 16, bottom: 12, height: 18, left: 16, position: 'absolute', right: 16 },
  pencil: { backgroundColor: '#E99068', borderRadius: 4, bottom: 33, height: 8, position: 'absolute', right: 62, transform: [{ rotate: '-18deg' }], width: 58 },
  notebook: { backgroundColor: '#FFFDF8', borderColor: '#D8B99D', borderRadius: 7, borderWidth: 2, bottom: 27, height: 48, left: 73, padding: 10, position: 'absolute', transform: [{ rotate: '5deg' }], width: 78 },
  notebookLine: { backgroundColor: '#DCE8D4', borderRadius: 2, height: 4, marginBottom: 7, width: 48 },
  notebookLineShort: { width: 32 },
  headingBlock: { alignItems: 'center', marginBottom: 30 },
  eyebrow: { color: '#A36E50', fontSize: 11, fontWeight: '700', letterSpacing: 1.7, marginBottom: 10 },
  title: { color: '#493D34', fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }), fontSize: 45, fontWeight: '700', letterSpacing: -1 },
  tagline: { color: '#5D5148', fontSize: 18, fontWeight: '600', lineHeight: 28, marginTop: 13, textAlign: 'center' },
  description: { color: '#8A7A6E', fontSize: 14, lineHeight: 22, marginTop: 8, textAlign: 'center' },
  authCard: { gap: 13 },
  authButton: { alignItems: 'center', borderRadius: 16, flexDirection: 'row', height: 56, justifyContent: 'center', paddingHorizontal: 18 },
  googleButton: { backgroundColor: '#FFFFFF', borderColor: '#E8DACE', borderWidth: 1, shadowColor: '#705746', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.08, shadowRadius: 9 },
  googleIcon: { alignItems: 'center', borderColor: '#E5DED8', borderRadius: 10, borderWidth: 1, height: 28, justifyContent: 'center', left: 18, position: 'absolute', width: 28 },
  googleIconText: { color: '#4285F4', fontSize: 17, fontWeight: '800' },
  googleButtonText: { color: '#493D34', fontSize: 16, fontWeight: '600' },
  lineButton: { backgroundColor: '#06C755' },
  lineIcon: { alignItems: 'center', height: 28, justifyContent: 'center', left: 18, position: 'absolute', width: 36 },
  lineIconText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  lineButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  appleButtonWrap: { height: 56, position: 'relative' },
  appleNativeButton: { height: 56, width: '100%' },
  appleLoading: { alignItems: 'center', backgroundColor: '#171513', borderRadius: 16, height: 56, justifyContent: 'center', left: 0, position: 'absolute', right: 0, top: 0 },
  appleFallbackButton: { backgroundColor: '#171513' },
  appleMark: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', left: 25, position: 'absolute' },
  appleButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  buttonPressed: { opacity: 0.84, transform: [{ scale: 0.99 }] },
  buttonDisabled: { opacity: 0.62 },
  errorBox: { backgroundColor: '#FFF0EC', borderColor: '#F2C9BC', borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11 },
  errorText: { color: '#9B4F3B', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  terms: { color: '#A5968A', fontSize: 12, lineHeight: 18, marginTop: 4, textAlign: 'center' },
});
