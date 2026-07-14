import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { layout, palette } from '@/constants/design';

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
  const accentLine =
    accent === 'warning'
      ? palette.warningSoft
      : accent === 'teal'
        ? palette.tealSoft
        : palette.borderSoft;

  return (
    <SafeAreaView edges={edges} style={styles.safeArea}>
      <View pointerEvents="none" style={styles.backdrop}>
        <View style={[styles.headerBand, { backgroundColor: accentLine }]} />
      </View>

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
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  fixedContent: {
    alignSelf: 'center',
    flex: 1,
    maxWidth: layout.maxWidth,
    paddingBottom: layout.bottomPadding,
    paddingHorizontal: layout.screenPaddingWide,
    width: '100%',
  },
  headerBand: {
    height: 96,
    left: 0,
    opacity: 0.32,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  safeArea: {
    backgroundColor: palette.background,
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
});
