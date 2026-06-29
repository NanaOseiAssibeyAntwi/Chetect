import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { font, palette, radius, shadow, type } from '@/constants/design';

type SurfaceTone = 'default' | 'muted' | 'raised' | 'dark';
type ButtonTone = 'primary' | 'accent' | 'secondary' | 'danger';
type MessageTone = 'neutral' | 'success' | 'warning' | 'danger';
type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'primary';

type SurfaceCardProps = {
  accentColor?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: SurfaceTone;
};

type SectionIntroProps = {
  action?: ReactNode;
  align?: 'left' | 'center';
  eyebrow?: string;
  subtitle?: string;
  title: string;
};

type AccentBadgeProps = {
  icon?: ReactNode;
  label: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  tone?: BadgeTone;
};

type MetricTileProps = {
  accentColor?: string;
  caption?: string;
  label: string;
  style?: StyleProp<ViewStyle>;
  tone?: SurfaceTone;
  value: string;
};

type ActionButtonProps = {
  compact?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
  label: string;
  onPress?: PressableProps['onPress'];
  textStyle?: StyleProp<TextStyle>;
  tone?: ButtonTone;
};

type InlineMessageProps = {
  action?: ReactNode;
  description: string;
  style?: StyleProp<ViewStyle>;
  title?: string;
  tone?: MessageTone;
};

const toneSurfaceStyles: Record<SurfaceTone, ViewStyle> = {
  dark: {
    backgroundColor: palette.surfaceGlassDark,
    borderColor: palette.borderStrong,
  },
  default: {
    backgroundColor: palette.surfaceGlassStrong,
    borderColor: palette.border,
  },
  muted: {
    backgroundColor: palette.panel,
    borderColor: palette.borderSoft,
  },
  raised: {
    backgroundColor: palette.panelRaised,
    borderColor: palette.borderStrong,
  },
};

const badgeTones: Record<
  BadgeTone,
  { backgroundColor: string; borderColor: string; dotColor: string; textColor: string }
> = {
  danger: {
    backgroundColor: palette.dangerSoft,
    borderColor: 'rgba(255, 95, 105, 0.24)',
    dotColor: palette.danger,
    textColor: palette.danger,
  },
  neutral: {
    backgroundColor: palette.panelSoft,
    borderColor: palette.border,
    dotColor: palette.sky,
    textColor: palette.mutedStrong,
  },
  primary: {
    backgroundColor: palette.tealSoft,
    borderColor: 'rgba(57, 231, 219, 0.24)',
    dotColor: palette.teal,
    textColor: palette.teal,
  },
  success: {
    backgroundColor: palette.successSoft,
    borderColor: 'rgba(35, 223, 121, 0.24)',
    dotColor: palette.success,
    textColor: palette.success,
  },
  warning: {
    backgroundColor: palette.warningSoft,
    borderColor: 'rgba(242, 194, 48, 0.24)',
    dotColor: palette.warning,
    textColor: palette.warning,
  },
};

const buttonTones: Record<
  ButtonTone,
  { backgroundColor: string; borderColor: string; textColor: string }
> = {
  accent: {
    backgroundColor: palette.warning,
    borderColor: palette.warning,
    textColor: palette.background,
  },
  danger: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255, 95, 105, 0.48)',
    textColor: palette.danger,
  },
  primary: {
    backgroundColor: palette.teal,
    borderColor: palette.teal,
    textColor: palette.background,
  },
  secondary: {
    backgroundColor: palette.panelRaised,
    borderColor: palette.borderStrong,
    textColor: palette.text,
  },
};

const messageTones: Record<
  MessageTone,
  { accentColor: string; backgroundColor: string; borderColor: string }
> = {
  danger: {
    accentColor: palette.danger,
    backgroundColor: palette.dangerSoft,
    borderColor: 'rgba(255, 95, 105, 0.24)',
  },
  neutral: {
    accentColor: palette.sky,
    backgroundColor: palette.panelSoft,
    borderColor: palette.border,
  },
  success: {
    accentColor: palette.success,
    backgroundColor: palette.successSoft,
    borderColor: 'rgba(35, 223, 121, 0.24)',
  },
  warning: {
    accentColor: palette.warning,
    backgroundColor: palette.warningSoft,
    borderColor: 'rgba(242, 194, 48, 0.24)',
  },
};

export function SurfaceCard({
  accentColor,
  children,
  style,
  tone = 'default',
}: SurfaceCardProps) {
  return (
    <View
      style={[
        styles.surfaceCard,
        toneSurfaceStyles[tone],
        shadow.card,
        accentColor
          ? {
              borderColor: accentColor,
              shadowColor: accentColor,
              shadowOpacity: 0.08,
            }
          : null,
        style,
      ]}>
      {children}
    </View>
  );
}

export function SectionIntro({
  action,
  align = 'left',
  eyebrow,
  subtitle,
  title,
}: SectionIntroProps) {
  const centered = align === 'center';

  return (
    <View style={[styles.sectionIntro, centered ? styles.sectionIntroCentered : null]}>
      <View style={styles.sectionIntroText}>
        {eyebrow ? <Text style={[styles.sectionEyebrow, centered ? styles.centerText : null]}>{eyebrow}</Text> : null}
        <Text style={[styles.sectionTitle, centered ? styles.centerText : null]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.sectionSubtitle, centered ? styles.centerText : null]}>{subtitle}</Text>
        ) : null}
      </View>
      {action ? <View style={styles.sectionAction}>{action}</View> : null}
    </View>
  );
}

export function AccentBadge({
  icon,
  label,
  style,
  textStyle,
  tone = 'neutral',
}: AccentBadgeProps) {
  const presentation = badgeTones[tone];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: presentation.backgroundColor,
          borderColor: presentation.borderColor,
        },
        style,
      ]}>
      {icon ?? <View style={[styles.badgeDot, { backgroundColor: presentation.dotColor }]} />}
      <Text style={[styles.badgeText, { color: presentation.textColor }, textStyle]}>{label}</Text>
    </View>
  );
}

export function MetricTile({
  accentColor = palette.text,
  caption,
  label,
  style,
  tone = 'muted',
  value,
}: MetricTileProps) {
  return (
    <View style={[styles.metricTile, toneSurfaceStyles[tone], style]}>
      <Text style={[styles.metricValue, { color: accentColor }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      {caption ? <Text style={styles.metricCaption}>{caption}</Text> : null}
    </View>
  );
}

export function ActionButton({
  compact = false,
  containerStyle,
  disabled = false,
  fullWidth = true,
  icon,
  label,
  onPress,
  textStyle,
  tone = 'primary',
}: ActionButtonProps) {
  const presentation = buttonTones[tone];

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        compact ? styles.actionButtonCompact : null,
        !fullWidth ? styles.actionButtonInline : null,
        {
          backgroundColor: presentation.backgroundColor,
          borderColor: presentation.borderColor,
        },
        (pressed || disabled) ? styles.actionButtonPressed : null,
        containerStyle,
      ]}>
      {icon ? <View style={styles.actionButtonIcon}>{icon}</View> : null}
      <Text style={[styles.actionButtonText, { color: presentation.textColor }, textStyle]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function InlineMessage({
  action,
  description,
  style,
  title,
  tone = 'neutral',
}: InlineMessageProps) {
  const presentation = messageTones[tone];

  return (
    <View
      style={[
        styles.inlineMessage,
        {
          backgroundColor: presentation.backgroundColor,
          borderColor: presentation.borderColor,
        },
        style,
      ]}>
      <View style={[styles.inlineMessageAccent, { backgroundColor: presentation.accentColor }]} />
      <View style={styles.inlineMessageBody}>
        {title ? <Text style={styles.inlineMessageTitle}>{title}</Text> : null}
        <Text style={styles.inlineMessageDescription}>{description}</Text>
        {action ? <View style={styles.inlineMessageAction}>{action}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 18,
    width: '100%',
  },
  actionButtonCompact: {
    minHeight: 38,
    paddingHorizontal: 12,
  },
  actionButtonIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonInline: {
    alignSelf: 'flex-start',
    width: undefined,
  },
  actionButtonPressed: {
    opacity: 0.88,
  },
  actionButtonText: {
    fontFamily: font.body,
    fontSize: type.bodyLarge,
    fontWeight: '900',
    letterSpacing: -0.05,
  },
  badge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeDot: {
    borderRadius: radius.pill,
    height: 6,
    width: 6,
  },
  badgeText: {
    fontFamily: font.mono,
    fontSize: type.tiny,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  centerText: {
    textAlign: 'center',
  },
  inlineMessage: {
    alignItems: 'flex-start',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  inlineMessageAccent: {
    borderRadius: radius.pill,
    marginTop: 3,
    minHeight: 10,
    width: 10,
  },
  inlineMessageAction: {
    marginTop: 14,
  },
  inlineMessageBody: {
    flex: 1,
  },
  inlineMessageDescription: {
    color: palette.mutedStrong,
    fontFamily: font.body,
    fontSize: type.body,
    lineHeight: 21,
  },
  inlineMessageTitle: {
    color: palette.text,
    fontFamily: font.body,
    fontSize: type.bodyLarge,
    fontWeight: '900',
    marginBottom: 4,
  },
  metricCaption: {
    color: palette.muted,
    fontFamily: font.body,
    fontSize: type.tiny,
    lineHeight: 15,
    marginTop: 8,
  },
  metricLabel: {
    color: palette.mutedStrong,
    fontFamily: font.mono,
    fontSize: type.tiny,
    fontWeight: '700',
    letterSpacing: 1.3,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  metricTile: {
    borderRadius: radius.sm,
    borderWidth: 1,
    flex: 1,
    minHeight: 84,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  metricValue: {
    fontFamily: font.display,
    fontSize: type.display - 6,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  sectionAction: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  sectionEyebrow: {
    color: palette.mutedStrong,
    fontFamily: font.mono,
    fontSize: type.tiny,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  sectionIntro: {
    gap: 14,
  },
  sectionIntroCentered: {
    alignItems: 'center',
  },
  sectionIntroText: {
    flexShrink: 1,
    gap: 8,
  },
  sectionSubtitle: {
    color: palette.mutedStrong,
    fontFamily: font.body,
    fontSize: type.body,
    lineHeight: 22,
  },
  sectionTitle: {
    color: palette.text,
    fontFamily: font.display,
    fontSize: type.display - 2,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  surfaceCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
});
