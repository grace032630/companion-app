import { Redirect, Stack, useGlobalSearchParams, usePathname } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AuthProvider, useAuth } from '../lib/auth';
import { createRoomReturnTo, parseRoomReturnTo, serializeRoomTarget } from '../lib/deep-link';
import { ProfileProvider } from '../lib/profile';

function RootNavigator() {
  const { session, loading } = useAuth();
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ returnTo?: string | string[]; roomId?: string | string[] }>();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const isLoginRoute = pathname === '/login';
  const incomingRoomReturnTo = pathname === '/room' ? createRoomReturnTo(params.roomId) : null;
  const postLoginTarget = parseRoomReturnTo(params.returnTo);

  if (!session && !isLoginRoute) {
    return incomingRoomReturnTo
      ? <Redirect href={{ pathname: '/login', params: { returnTo: incomingRoomReturnTo } }} />
      : <Redirect href="/login" />;
  }

  if (session && isLoginRoute) {
    return postLoginTarget
      ? <Redirect href={{ pathname: '/', params: { returnTo: serializeRoomTarget(postLoginTarget) } }} />
      : <Redirect href="/" />;
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
