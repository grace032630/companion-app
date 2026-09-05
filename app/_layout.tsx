import { Redirect, Stack, usePathname } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AuthProvider, useAuth } from '../lib/auth';
import { ProfileProvider, useProfile } from '../lib/profile';

function RootNavigator() {
  const { session, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const pathname = usePathname();

  if (authLoading || (session && profileLoading)) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const isLoginRoute = pathname === '/login';
  const isProfileSetupRoute = pathname === '/profile-setup';

  if (!session && !isLoginRoute) {
    return <Redirect href="/login" />;
  }

  if (session && !profile && !isProfileSetupRoute) {
    return <Redirect href="/profile-setup" />;
  }

  if (session && profile && (isLoginRoute || isProfileSetupRoute)) {
    return <Redirect href="/" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ProfileProvider>
        <RootNavigator />
      </ProfileProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    backgroundColor: '#FFF9F1',
    flex: 1,
    justifyContent: 'center',
  },
});
