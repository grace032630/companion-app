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
  ImageBackground,
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
    <ImageBackground
      source={require('../assets/backgrounds/login-bg.png')}
      resizeMode="contain"
      style={styles.background}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <View style={styles.introCopy}>
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
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { backgroundColor: '#F7E6D2', flex: 1, width: '100%' },
  safeArea: { backgroundColor: 'transparent', flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 20 },
  content: { alignSelf: 'center', flex: 1, justifyContent: 'flex-end', maxWidth: 430, minHeight: 760, paddingBottom: 18, paddingTop: 390, width: '100%' },
  introCopy: { alignItems: 'center', backgroundColor: 'rgba(255,249,241,0.82)', borderRadius: 18, marginBottom: 18, paddingHorizontal: 14, paddingVertical: 12 },
  tagline: { color: '#5D5148', fontSize: 18, fontWeight: '700', lineHeight: 28, textAlign: 'center' },
  description: { color: '#7E6F64', fontSize: 14, lineHeight: 22, marginTop: 6, textAlign: 'center' },
  authCard: { gap: 13 },
  authButton: { alignItems: 'center', borderRadius: 16, flexDirection: 'row', height: 56, justifyContent: 'center', paddingHorizontal: 18 },
  googleButton: { backgroundColor: 'rgba(255,255,255,0.96)', borderColor: '#E8DACE', borderWidth: 1, shadowColor: '#705746', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.08, shadowRadius: 9 },
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
  errorBox: { backgroundColor: 'rgba(255,240,236,0.96)', borderColor: '#F2C9BC', borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11 },
  errorText: { color: '#9B4F3B', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  terms: { backgroundColor: 'rgba(255,249,241,0.74)', borderRadius: 10, color: '#8A7A6E', fontSize: 12, lineHeight: 18, marginTop: 4, paddingHorizontal: 8, paddingVertical: 5, textAlign: 'center' },
});
