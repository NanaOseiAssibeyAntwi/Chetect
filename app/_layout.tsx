import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { palette } from '@/constants/design';
import { SessionProvider, useSession } from '@/providers/session-provider';

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: palette.background,
    border: palette.border,
    card: palette.panel,
    notification: palette.danger,
    primary: palette.teal,
    text: palette.text,
  },
};

function RootStack() {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, isLoading, role } = useSession();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const rootSegment = String(segments[0] ?? '');
    const isAuthRoute =
      !rootSegment ||
      rootSegment === 'index' ||
      rootSegment === 'sign-in' ||
      rootSegment === 'invigilator-sign-in';
    const isStudentRoute = rootSegment === '(tabs)' || rootSegment === 'exam-session';
    const isInvigilatorRoute = rootSegment === '(invigilator-tabs)';

    if (!isAuthenticated) {
      if (!isAuthRoute) {
        router.replace('/');
      }
      return;
    }

    if (role === 'student') {
      if (isAuthRoute || isInvigilatorRoute) {
        router.replace('/(tabs)');
      }
      return;
    }

    if (role === 'invigilator' || role === 'admin') {
      if (isAuthRoute || isStudentRoute) {
        router.replace('/(invigilator-tabs)');
      }
    }
  }, [isAuthenticated, isLoading, role, router, segments]);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.background } }}>
      <Stack.Screen name="index" options={{ gestureEnabled: false }} />
      <Stack.Screen name="sign-in" options={{ gestureEnabled: false }} />
      <Stack.Screen name="invigilator-sign-in" options={{ gestureEnabled: false }} />
      <Stack.Screen name="exam-session" options={{ gestureEnabled: false }} />
      <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
      <Stack.Screen name="(invigilator-tabs)" options={{ gestureEnabled: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider value={navigationTheme}>
      <SessionProvider>
        <RootStack />
      </SessionProvider>
      <StatusBar style="dark" backgroundColor={palette.background} />
    </ThemeProvider>
  );
}
