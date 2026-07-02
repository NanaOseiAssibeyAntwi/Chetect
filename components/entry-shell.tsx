import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/brand-mark';
import { font, layout, palette, radius, shadow, type } from '@/constants/design';

export type EntryAccent = 'teal' | 'warning';

export const entryAccents: Record<
  EntryAccent,
  {
    accent: string;
    accentContrast: string;
    border: string;
    glow: string;
    panel: string;
    soft: string;
    stripe: string;
  }
> = {
  teal: {
    accent: palette.teal,
    accentContrast: '#03262d',
    border: 'rgba(45, 228, 216, 0.34)',
    glow: 'rgba(45, 228, 216, 0.18)',
    panel: 'rgba(7, 20, 37, 0.82)',
    soft: 'rgba(11, 52, 58, 0.88)',
    stripe: 'rgba(45, 228, 216, 0.22)',
  },
  warning: {
    accent: palette.warning,
    accentContrast: '#221600',
    border: 'rgba(241, 191, 33, 0.34)',
    glow: 'rgba(241, 191, 33, 0.16)',
    panel: 'rgba(14, 18, 28, 0.84)',
    soft: 'rgba(54, 41, 17, 0.9)',
    stripe: 'rgba(241, 191, 33, 0.2)',
  },
};

type EntryScreenProps = {
  accent?: EntryAccent;
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  edges?: Edge[];
  keyboardAware?: boolean;
  scroll?: boolean;
};

type EntryPanelProps = {
  accent?: EntryAccent;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

type EntryBadgeProps = {
  accent?: EntryAccent;
  detail?: string;
  label: string;
  style?: StyleProp<ViewStyle>;
};

type EntryWordmarkProps = {
  accent?: EntryAccent;
  align?: 'left' | 'center';
  eyebrow?: string;
  subtitle?: string;
  title?: string;
};

type EntryMetricPillProps = {
  accent?: EntryAccent;
  label: string;
  style?: StyleProp<ViewStyle>;
  value: string;
};

function EntryBackdrop({ accent }: { accent: EntryAccent }) {
  const tone = entryAccents[accent];

  return (
    <View pointerEvents="none" style={styles.backdrop}>
      <View style={[styles.topGlow, { backgroundColor: tone.glow }]} />
      <View style={[styles.bottomGlow, { backgroundColor: tone.glow }]} />
      <View style={[styles.rightGlow, { backgroundColor: tone.glow }]} />
      <View style={[styles.frame, { borderColor: tone.stripe }]} />
      <View style={[styles.centerColumn, { borderColor: tone.stripe }]} />
      <View style={[styles.upperRail, { backgroundColor: tone.stripe }]} />
      <View style={[styles.midRail, { backgroundColor: tone.stripe }]} />
      <View style={styles.outerRails}>
        <View style={styles.outerRail} />
        <View style={styles.outerRail} />
      </View>
      <View style={styles.gridColumns}>
        <View style={styles.gridColumn} />
        <View style={styles.gridColumn} />
        <View style={styles.gridColumn} />
      </View>
      <View style={styles.orbitRingLarge} />
      <View style={styles.orbitRingSmall} />
    </View>
  );
}

export function EntryScreen({
  accent = 'teal',
  children,
  contentContainerStyle,
  edges = ['top', 'bottom'],
  keyboardAware = false,
  scroll = true,
}: EntryScreenProps) {
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.fixedContent, contentContainerStyle]}>{children}</View>
  );

  return (
    <SafeAreaView edges={edges} style={styles.safeArea}>
      <View style={styles.shell}>
        <EntryBackdrop accent={accent} />
        <KeyboardAvoidingView
          behavior={keyboardAware ? Platform.select({ ios: 'padding', default: undefined }) : undefined}
          style={styles.flex}>
          {content}
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

export function EntryPanel({ accent = 'teal', children, style }: EntryPanelProps) {
  const tone = entryAccents[accent];

  return (
    <View
      style={[
        styles.panel,
        shadow.card,
        {
          backgroundColor: tone.panel,
          borderColor: tone.border,
        },
        style,
      ]}>
      <View style={[styles.panelStripe, { backgroundColor: tone.stripe }]} />
      {children}
    </View>
  );
}

export function EntryBadge({ accent = 'teal', detail, label, style }: EntryBadgeProps) {
  const tone = entryAccents[accent];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: tone.soft,
          borderColor: tone.border,
        },
        style,
      ]}>
      <View style={[styles.badgeDot, { backgroundColor: tone.accent }]} />
      <Text style={[styles.badgeLabel, { color: tone.accent }]}>{label}</Text>
      {detail ? <Text style={styles.badgeDetail}>{detail}</Text> : null}
    </View>
  );
}

export function EntryWordmark({
  accent = 'teal',
  align = 'left',
  eyebrow,
  subtitle,
  title = 'Chetect',
}: EntryWordmarkProps) {
  const centered = align === 'center';

  return (
    <View style={[styles.wordmark, centered ? styles.wordmarkCentered : null]}>
      <BrandMark accent={accent} size={72} />
      <View style={styles.wordmarkText}>
        {eyebrow ? <Text style={[styles.eyebrow, centered ? styles.centerText : null]}>{eyebrow}</Text> : null}
        <Text style={[styles.wordmarkTitle, centered ? styles.centerText : null]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.wordmarkSubtitle, centered ? styles.centerText : null]}>{subtitle}</Text>
        ) : null}
      </View>
    </View>
  );
}

export function EntryMetricPill({ accent = 'teal', label, style, value }: EntryMetricPillProps) {
  const tone = entryAccents[accent];

  return (
    <View
      style={[
        styles.metricPill,
        {
          backgroundColor: tone.soft,
          borderColor: tone.border,
        },
        style,
      ]}>
      <Text style={[styles.metricValue, { color: tone.accent }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  badge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  badgeDetail: {
    color: palette.mutedStrong,
    fontFamily: font.mono,
    fontSize: type.tiny,
    letterSpacing: 1.2,
  },
  badgeDot: {
    borderRadius: radius.pill,
    height: 7,
    width: 7,
  },
  badgeLabel: {
    fontFamily: font.mono,
    fontSize: type.tiny,
    fontWeight: '800',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  bottomGlow: {
    borderRadius: radius.pill,
    bottom: -140,
    height: 280,
    left: -70,
    position: 'absolute',
    width: 280,
  },
  centerColumn: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    bottom: 0,
    left: '11%',
    position: 'absolute',
    top: 0,
    width: '78%',
  },
  centerText: {
    textAlign: 'center',
  },
  eyebrow: {
    color: palette.mutedStrong,
    fontFamily: font.mono,
    fontSize: type.tiny,
    fontWeight: '800',
    letterSpacing: 2.1,
    textTransform: 'uppercase',
  },
  fixedContent: {
    alignSelf: 'center',
    flex: 1,
    justifyContent: 'center',
    maxWidth: layout.maxWidth + 26,
    paddingBottom: layout.bottomPadding,
    paddingHorizontal: layout.screenPadding,
    width: '100%',
  },
  flex: {
    flex: 1,
  },
  frame: {
    borderWidth: 1,
    bottom: 16,
    left: 16,
    opacity: 0.22,
    position: 'absolute',
    right: 16,
    top: 16,
  },
  gridColumn: {
    backgroundColor: 'rgba(99, 126, 168, 0.08)',
    height: '100%',
    width: 1,
  },
  gridColumns: {
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: '14%',
    opacity: 0.8,
    position: 'absolute',
    right: '14%',
    top: 0,
  },
  metricLabel: {
    color: palette.mutedStrong,
    fontFamily: font.mono,
    fontSize: type.tiny,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 6,
    textTransform: 'uppercase',
  },
  metricPill: {
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 78,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  metricValue: {
    fontFamily: font.display,
    fontSize: type.display - 1,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  orbitRingLarge: {
    borderColor: 'rgba(111, 145, 190, 0.08)',
    borderRadius: 240,
    borderWidth: 1,
    height: 240,
    position: 'absolute',
    right: -70,
    top: 84,
    width: 240,
  },
  orbitRingSmall: {
    borderColor: 'rgba(111, 145, 190, 0.08)',
    borderRadius: 168,
    borderWidth: 1,
    height: 168,
    left: -68,
    position: 'absolute',
    top: 184,
    width: 168,
  },
  outerRail: {
    backgroundColor: 'rgba(99, 126, 168, 0.16)',
    flex: 1,
    width: 1,
  },
  outerRails: {
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 16,
    position: 'absolute',
    right: 16,
    top: 0,
  },
  panel: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingVertical: 18,
    position: 'relative',
  },
  panelStripe: {
    height: 1,
    left: 18,
    opacity: 0.9,
    position: 'absolute',
    right: 18,
    top: 0,
  },
  rightGlow: {
    borderRadius: radius.pill,
    bottom: 70,
    height: 240,
    position: 'absolute',
    right: -90,
    width: 240,
  },
  safeArea: {
    backgroundColor: palette.background,
    flex: 1,
  },
  scrollContent: {
    alignSelf: 'center',
    flexGrow: 1,
    maxWidth: layout.maxWidth + 26,
    paddingBottom: layout.bottomPadding,
    paddingHorizontal: layout.screenPadding,
    width: '100%',
  },
  shell: {
    backgroundColor: palette.background,
    flex: 1,
  },
  topGlow: {
    borderRadius: radius.pill,
    height: 250,
    left: -88,
    position: 'absolute',
    top: -100,
    width: 250,
  },
  upperRail: {
    height: 1,
    left: '10%',
    opacity: 0.55,
    position: 'absolute',
    right: '10%',
    top: 112,
  },
  midRail: {
    height: 1,
    left: '7%',
    opacity: 0.2,
    position: 'absolute',
    right: '7%',
    top: '49%',
  },
  wordmark: {
    gap: 20,
  },
  wordmarkCentered: {
    alignItems: 'center',
  },
  wordmarkSubtitle: {
    color: palette.mutedStrong,
    fontFamily: font.body,
    fontSize: type.bodyLarge,
    lineHeight: 24,
    marginTop: 10,
  },
  wordmarkText: {
    flexShrink: 1,
  },
  wordmarkTitle: {
    color: palette.text,
    fontFamily: font.display,
    fontSize: type.hero + 2,
    fontWeight: '900',
    letterSpacing: -1.7,
    lineHeight: type.hero + 9,
    marginTop: 10,
  },
});
