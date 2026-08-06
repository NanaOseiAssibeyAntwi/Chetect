import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { layout } from '@/constants/design';
import { useAppTheme } from '@/hooks/use-app-theme';

type AppScreenProps = {
  accent?: 'neutral' | 'teal' | 'warning';
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  edges?: Edge[];
  scroll?: boolean;
};

export function AppScreen({
  accent = 'neutral',
  children,
  contentContainerStyle,
  edges = ['top', 'bottom'],
  scroll = true,
}: AppScreenProps) {
  const { colors } = useAppTheme();
  const accentColor =
    accent === 'teal' ? colors.teal : accent === 'warning' ? colors.warning : colors.border;

  return (
    <SafeAreaView edges={edges} style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View pointerEvents="none" style={[styles.topRule, { backgroundColor: accentColor }]} />

      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fixedContent, contentContainerStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fixedContent: {
    alignSelf: 'center',
    flex: 1,
    maxWidth: layout.maxWidth,
    paddingBottom: layout.bottomPadding,
    paddingHorizontal: layout.screenPaddingWide,
    width: '100%',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    alignSelf: 'center',
    flexGrow: 1,
    maxWidth: layout.maxWidth,
    paddingBottom: layout.bottomPadding,
    paddingHorizontal: layout.screenPaddingWide,
    width: '100%',
  },
  topRule: {
    height: 2,
    left: 0,
    opacity: 0.55,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
