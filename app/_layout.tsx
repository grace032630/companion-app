import { Redirect, Stack, usePathname } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AuthProvider, useAuth } from '../lib/auth';

function RootNavigator() {
  const { session, loading } = useAuth();
  const pathname = usePathname();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const isLoginRoute = pathname === '/login';

  if (!session && !isLoginRoute) {
    return <Redirect href="/login" />;
  }

  if (session && isLoginRoute) {
    return <Redirect href="/" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
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
