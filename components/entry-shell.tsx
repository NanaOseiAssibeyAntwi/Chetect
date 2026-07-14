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
    accentContrast: '#ffffff',
    border: palette.border,
    glow: palette.tealSoft,
    panel: palette.panel,
    soft: palette.tealSoft,
    stripe: palette.teal,
  },
  warning: {
    accent: palette.warning,
    accentContrast: '#ffffff',
    border: palette.border,
    glow: palette.warningSoft,
    panel: palette.panel,
    soft: palette.warningSoft,
    stripe: palette.warning,
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
      <View style={[styles.headerBand, { backgroundColor: tone.glow }]} />
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
    display: 'none',
  },
  centerColumn: {
    display: 'none',
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
    display: 'none',
  },
  gridColumn: {
    display: 'none',
  },
  gridColumns: {
    display: 'none',
  },
  headerBand: {
    height: 120,
    left: 0,
    opacity: 0.58,
    position: 'absolute',
    right: 0,
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
    letterSpacing: 0,
  },
  orbitRingLarge: {
    display: 'none',
  },
  orbitRingSmall: {
    display: 'none',
  },
  outerRail: {
    display: 'none',
  },
  outerRails: {
    display: 'none',
  },
  panel: {
    borderRadius: radius.md,
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
    display: 'none',
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
    display: 'none',
  },
  upperRail: {
    display: 'none',
  },
  midRail: {
    display: 'none',
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
    fontSize: type.hero,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: type.hero + 9,
    marginTop: 10,
  },
});
