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
  const accentGlow =
    accent === 'warning'
      ? 'rgba(242, 194, 48, 0.14)'
      : accent === 'teal'
        ? 'rgba(57, 231, 219, 0.12)'
        : 'rgba(92, 168, 255, 0.10)';
  const accentLine =
    accent === 'warning'
      ? 'rgba(242, 194, 48, 0.22)'
      : accent === 'teal'
        ? 'rgba(57, 231, 219, 0.18)'
        : 'rgba(92, 168, 255, 0.18)';

  return (
    <SafeAreaView edges={edges} style={styles.safeArea}>
      <View pointerEvents="none" style={styles.backdrop}>
        <View style={[styles.topGlow, { backgroundColor: accentGlow }]} />
        <View style={[styles.sideGlow, { backgroundColor: accentGlow }]} />
        <View style={[styles.headerBand, { borderBottomColor: accentLine }]} />
        <View style={[styles.centerBand, { borderColor: accentLine }]} />
        <View style={[styles.scanLine, { backgroundColor: accentLine }]} />
        <View style={[styles.crossLine, { backgroundColor: accentLine }]} />
        <View style={styles.leftRail} />
        <View style={styles.rightRail} />
        <View style={styles.grid} />
        <View style={styles.frameInset} />
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
  centerBand: {
    borderColor: 'transparent',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    bottom: 0,
    left: '9.5%',
    position: 'absolute',
    top: 0,
    width: '81%',
  },
  crossLine: {
    height: 1,
    left: '10%',
    opacity: 0.12,
    position: 'absolute',
    right: '10%',
    top: '23%',
  },
  fixedContent: {
    alignSelf: 'center',
    flex: 1,
    maxWidth: layout.maxWidth,
    paddingBottom: layout.bottomPadding,
    paddingHorizontal: layout.screenPaddingWide,
    width: '100%',
  },
  frameInset: {
    borderColor: 'rgba(66, 111, 170, 0.08)',
    borderWidth: 1,
    bottom: 18,
    left: 18,
    opacity: 0.24,
    position: 'absolute',
    right: 18,
    top: 18,
  },
  grid: {
    borderColor: 'rgba(66, 111, 170, 0.08)',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    bottom: 0,
    left: '18%',
    position: 'absolute',
    top: 0,
    width: '64%',
  },
  headerBand: {
    borderBottomColor: 'transparent',
    borderBottomWidth: 1,
    height: 108,
    left: 18,
    opacity: 0.32,
    position: 'absolute',
    right: 18,
    top: 0,
  },
  leftRail: {
    backgroundColor: 'rgba(66, 111, 170, 0.12)',
    bottom: 0,
    left: 18,
    position: 'absolute',
    top: 0,
    width: 1,
  },
  rightRail: {
    backgroundColor: 'rgba(66, 111, 170, 0.12)',
    bottom: 0,
    position: 'absolute',
    right: 18,
    top: 0,
    width: 1,
  },
  safeArea: {
    backgroundColor: palette.background,
    flex: 1,
  },
  scanLine: {
    height: 1,
    left: 0,
    opacity: 0.3,
    position: 'absolute',
    right: 0,
    top: '48%',
  },
  scrollContent: {
    alignSelf: 'center',
    flexGrow: 1,
    maxWidth: layout.maxWidth,
    paddingBottom: layout.bottomPadding,
    paddingHorizontal: layout.screenPaddingWide,
    width: '100%',
  },
  sideGlow: {
    borderRadius: 999,
    bottom: -110,
    height: 260,
    position: 'absolute',
    right: -76,
    width: 260,
  },
  topGlow: {
    borderRadius: 999,
    height: 220,
    left: -72,
    position: 'absolute',
    top: -90,
    width: 220,
  },
});
