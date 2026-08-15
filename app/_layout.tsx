import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import 'react-native-reanimated';

import { BootSplash } from '@/components/boot-splash';
import { InvigilatorAlertToasts } from '@/components/invigilator-alert-toasts';
import { useAppTheme } from '@/hooks/use-app-theme';
import { SessionProvider, useSession } from '@/providers/session-provider';

function RootStack() {
  const { colors, isDark } = useAppTheme();
  const navigationTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      border: colors.border,
      card: colors.panel,
      notification: colors.danger,
      primary: colors.teal,
      text: colors.text,
    },
  };

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
    <ThemeProvider value={navigationTheme}>
      {isLoading ? (
        <>
          <BootSplash />
          <StatusBar backgroundColor={colors.background} style={isDark ? 'light' : 'dark'} />
        </>
      ) : (
        <>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
            <Stack.Screen name="index" options={{ gestureEnabled: false }} />
            <Stack.Screen name="sign-in" options={{ gestureEnabled: false }} />
            <Stack.Screen name="invigilator-sign-in" options={{ gestureEnabled: false }} />
            <Stack.Screen name="exam-session" options={{ gestureEnabled: false }} />
            <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
            <Stack.Screen name="(invigilator-tabs)" options={{ gestureEnabled: false }} />
          </Stack>
          <InvigilatorAlertToasts />
          <StatusBar backgroundColor={colors.background} style={isDark ? 'light' : 'dark'} />
        </>
      )}
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [iconsLoaded, iconLoadError] = useFonts({
    ...Feather.font,
    ...Ionicons.font,
    ...MaterialCommunityIcons.font,
    ...MaterialIcons.font,
  });

  if (!iconsLoaded && !iconLoadError) {
    return (
      <View style={styles.iconLoadingScreen}>
        <ActivityIndicator color="#0f766e" size="small" />
      </View>
    );
  }

  return (
    <SessionProvider>
      <RootStack />
    </SessionProvider>
  );
}

const styles = StyleSheet.create({
  iconLoadingScreen: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    flex: 1,
    justifyContent: 'center',
  },
});
