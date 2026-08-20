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
import { font, layout, radius, type } from '@/constants/design';
import { useAppTheme } from '@/hooks/use-app-theme';

export type EntryAccent = 'teal' | 'warning';

export function useEntryAccents() {
  const { colors } = useAppTheme();

  return {
    teal: {
      accent: colors.teal,
      accentContrast: colors.background,
      border: colors.border,
      panel: colors.panel,
      soft: colors.tealSoft,
      stripe: colors.teal,
    },
    warning: {
      accent: colors.warning,
      accentContrast: colors.background,
      border: colors.border,
      panel: colors.panel,
      soft: colors.warningSoft,
      stripe: colors.warning,
    },
  } as const satisfies Record<
    EntryAccent,
    {
      accent: string;
      accentContrast: string;
      border: string;
      panel: string;
      soft: string;
      stripe: string;
    }
  >;
}

type EntryScreenProps = {
  accent?: EntryAccent;
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  edges?: Edge[];
  header?: ReactNode;
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

function EntryBackdrop() {
  const { colors } = useAppTheme();

  return <View pointerEvents="none" style={[styles.topRule, { backgroundColor: colors.teal }]} />;
}

export function EntryScreen({
  children,
  contentContainerStyle,
  edges = ['top', 'bottom'],
  header,
  keyboardAware = false,
  scroll = true,
}: EntryScreenProps) {
  const { colors } = useAppTheme();

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
    <SafeAreaView edges={edges} style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={[styles.shell, { backgroundColor: colors.background }]}>
        <EntryBackdrop />
        {header ? <View style={styles.fixedHeader}>{header}</View> : null}
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
  const tone = useEntryAccents()[accent];

  return (
    <View
      style={[
        styles.panel,
        {
          backgroundColor: tone.panel,
          borderColor: tone.border,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

export function EntryBadge({ accent = 'teal', detail, label, style }: EntryBadgeProps) {
  const { colors } = useAppTheme();
  const tone = useEntryAccents()[accent];

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
      {detail ? <Text style={[styles.badgeDetail, { color: colors.mutedStrong }]}>{detail}</Text> : null}
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
  const { colors } = useAppTheme();
  const centered = align === 'center';

  return (
    <View style={[styles.wordmark, centered ? styles.wordmarkCentered : null]}>
      <BrandMark accent={accent} size={72} />
      <View style={styles.wordmarkText}>
        {eyebrow ? (
          <Text style={[styles.eyebrow, { color: colors.mutedStrong }, centered ? styles.centerText : null]}>
            {eyebrow}
          </Text>
        ) : null}
        <Text style={[styles.wordmarkTitle, { color: colors.text }, centered ? styles.centerText : null]}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.wordmarkSubtitle, { color: colors.mutedStrong }, centered ? styles.centerText : null]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function EntryMetricPill({ accent = 'teal', label, style, value }: EntryMetricPillProps) {
  const { colors } = useAppTheme();
  const tone = useEntryAccents()[accent];

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
      <Text style={[styles.metricLabel, { color: colors.mutedStrong }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  centerText: {
    textAlign: 'center',
  },
  eyebrow: {
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
  fixedHeader: {
    alignSelf: 'center',
    maxWidth: layout.maxWidth + 26,
    paddingBottom: 10,
    paddingHorizontal: layout.screenPadding,
    paddingTop: 14,
    width: '100%',
    zIndex: 2,
  },
  flex: {
    flex: 1,
  },
  metricLabel: {
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
  panel: {
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingVertical: 18,
    position: 'relative',
    shadowColor: '#0b3b75',
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  safeArea: {
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
    flex: 1,
  },
  topRule: {
    height: 2,
    left: 0,
    opacity: 0.55,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  wordmark: {
    gap: 20,
  },
  wordmarkCentered: {
    alignItems: 'center',
  },
  wordmarkSubtitle: {
    fontFamily: font.body,
    fontSize: type.bodyLarge,
    lineHeight: 24,
    marginTop: 10,
  },
  wordmarkText: {
    flexShrink: 1,
  },
  wordmarkTitle: {
    fontFamily: font.display,
    fontSize: type.hero,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: type.hero + 9,
    marginTop: 10,
  },
});
