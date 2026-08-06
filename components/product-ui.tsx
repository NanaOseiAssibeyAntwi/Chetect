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

import { font, radius, shadow, type } from '@/constants/design';
import { useAppTheme } from '@/hooks/use-app-theme';

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

export function SurfaceCard({ accentColor, children, style, tone = 'default' }: SurfaceCardProps) {
  const { colors } = useAppTheme();

  const toneSurfaceStyles: Record<SurfaceTone, ViewStyle> = {
    dark: { backgroundColor: colors.surfaceGlassDark, borderColor: colors.borderStrong },
    default: { backgroundColor: colors.surfaceGlassStrong, borderColor: colors.border },
    muted: { backgroundColor: colors.panel, borderColor: colors.borderSoft },
    raised: { backgroundColor: colors.panelRaised, borderColor: colors.borderStrong },
  };

  return (
    <View
      style={[
        styles.surfaceCard,
        toneSurfaceStyles[tone],
        shadow.card,
        accentColor
          ? {
              borderLeftColor: accentColor,
              borderLeftWidth: 3,
              shadowColor: accentColor,
              shadowOpacity: 0.1,
            }
          : null,
        style,
      ]}>
      {children}
    </View>
  );
}

export function SectionIntro({ action, align = 'left', eyebrow, subtitle, title }: SectionIntroProps) {
  const { colors } = useAppTheme();
  const centered = align === 'center';

  return (
    <View style={[styles.sectionIntro, centered ? styles.sectionIntroCentered : null]}>
      <View style={styles.sectionIntroText}>
        {eyebrow ? (
          <Text
            style={[styles.sectionEyebrow, { color: colors.mutedStrong }, centered ? styles.centerText : null]}>
            {eyebrow}
          </Text>
        ) : null}
        <Text style={[styles.sectionTitle, { color: colors.text }, centered ? styles.centerText : null]}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.sectionSubtitle, { color: colors.mutedStrong }, centered ? styles.centerText : null]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action ? <View style={styles.sectionAction}>{action}</View> : null}
    </View>
  );
}

export function AccentBadge({ icon, label, style, textStyle, tone = 'neutral' }: AccentBadgeProps) {
  const { colors } = useAppTheme();

  const badgeTones: Record<
    BadgeTone,
    { backgroundColor: string; borderColor: string; dotColor: string; textColor: string }
  > = {
    danger: {
      backgroundColor: colors.dangerSoft,
      borderColor: colors.dangerSoft,
      dotColor: colors.danger,
      textColor: colors.danger,
    },
    neutral: {
      backgroundColor: colors.panelSoft,
      borderColor: colors.border,
      dotColor: colors.sky,
      textColor: colors.mutedStrong,
    },
    primary: {
      backgroundColor: colors.tealSoft,
      borderColor: colors.tealGlow,
      dotColor: colors.teal,
      textColor: colors.teal,
    },
    success: {
      backgroundColor: colors.successSoft,
      borderColor: colors.successSoft,
      dotColor: colors.success,
      textColor: colors.success,
    },
    warning: {
      backgroundColor: colors.warningSoft,
      borderColor: colors.warningSoft,
      dotColor: colors.warning,
      textColor: colors.warning,
    },
  };
  const presentation = badgeTones[tone];

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: presentation.backgroundColor, borderColor: presentation.borderColor },
        style,
      ]}>
      {icon ?? <View style={[styles.badgeDot, { backgroundColor: presentation.dotColor }]} />}
      <Text style={[styles.badgeText, { color: presentation.textColor }, textStyle]}>{label}</Text>
    </View>
  );
}

export function MetricTile({ accentColor, caption, label, style, tone = 'muted', value }: MetricTileProps) {
  const { colors } = useAppTheme();

  const toneSurfaceStyles: Record<SurfaceTone, ViewStyle> = {
    dark: { backgroundColor: colors.surfaceGlassDark, borderColor: colors.borderStrong },
    default: { backgroundColor: colors.surfaceGlassStrong, borderColor: colors.border },
    muted: { backgroundColor: colors.panel, borderColor: colors.borderSoft },
    raised: { backgroundColor: colors.panelRaised, borderColor: colors.borderStrong },
  };

  return (
    <View style={[styles.metricTile, toneSurfaceStyles[tone], style]}>
      <Text style={[styles.metricValue, { color: accentColor ?? colors.text }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.mutedStrong }]}>{label}</Text>
      {caption ? <Text style={[styles.metricCaption, { color: colors.muted }]}>{caption}</Text> : null}
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
  const { colors } = useAppTheme();

  const buttonTones: Record<ButtonTone, { backgroundColor: string; borderColor: string; textColor: string }> = {
    accent: { backgroundColor: colors.warning, borderColor: colors.warning, textColor: '#ffffff' },
    danger: { backgroundColor: 'transparent', borderColor: colors.borderStrong, textColor: colors.danger },
    primary: { backgroundColor: colors.teal, borderColor: colors.teal, textColor: '#ffffff' },
    secondary: { backgroundColor: colors.panelRaised, borderColor: colors.borderStrong, textColor: colors.text },
  };
  const presentation = buttonTones[tone];

  const content = (
    <>
      {icon ? <View style={styles.actionButtonIcon}>{icon}</View> : null}
      <Text
        style={[
          styles.actionButtonText,
          { color: presentation.textColor },
          textStyle,
        ]}>
        {label}
      </Text>
    </>
  );

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
      {content}
    </Pressable>
  );
}

export function InlineMessage({ action, description, style, title, tone = 'neutral' }: InlineMessageProps) {
  const { colors } = useAppTheme();

  const messageTones: Record<MessageTone, { accentColor: string; backgroundColor: string; borderColor: string }> = {
    danger: { accentColor: colors.danger, backgroundColor: colors.panel, borderColor: colors.border },
    neutral: { accentColor: colors.sky, backgroundColor: colors.panelSoft, borderColor: colors.border },
    success: { accentColor: colors.success, backgroundColor: colors.panel, borderColor: colors.border },
    warning: { accentColor: colors.warning, backgroundColor: colors.panel, borderColor: colors.border },
  };
  const presentation = messageTones[tone];

  return (
    <View
      style={[
        styles.inlineMessage,
        { backgroundColor: presentation.backgroundColor, borderColor: presentation.borderColor },
        style,
      ]}>
      <View style={[styles.inlineMessageAccent, { backgroundColor: presentation.accentColor }]} />
      <View style={styles.inlineMessageBody}>
        {title ? <Text style={[styles.inlineMessageTitle, { color: colors.text }]}>{title}</Text> : null}
        <Text style={[styles.inlineMessageDescription, { color: colors.mutedStrong }]}>{description}</Text>
        {action ? <View style={styles.inlineMessageAction}>{action}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 20,
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
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  actionButtonText: {
    fontFamily: font.body,
    fontSize: type.bodyLarge,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  badge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeDot: {
    borderRadius: radius.pill,
    height: 6,
    width: 6,
  },
  badgeText: {
    fontFamily: font.body,
    fontSize: type.tiny,
    fontWeight: '700',
    letterSpacing: 0.5,
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
    fontFamily: font.body,
    fontSize: type.body,
    lineHeight: 21,
  },
  inlineMessageTitle: {
    fontFamily: font.body,
    fontSize: type.bodyLarge,
    fontWeight: '900',
    marginBottom: 4,
  },
  metricCaption: {
    fontFamily: font.body,
    fontSize: type.tiny,
    lineHeight: 15,
    marginTop: 8,
  },
  metricLabel: {
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
    minHeight: 82,
    paddingHorizontal: 14,
    paddingVertical: 14,
    ...shadow.card,
  },
  metricValue: {
    fontFamily: font.display,
    fontSize: type.display - 6,
    fontWeight: '900',
    letterSpacing: 0,
  },
  sectionAction: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  sectionEyebrow: {
    fontFamily: font.body,
    fontSize: type.tiny,
    fontWeight: '800',
    letterSpacing: 0.8,
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
    fontFamily: font.body,
    fontSize: type.body,
    lineHeight: 22,
  },
  sectionTitle: {
    fontFamily: font.display,
    fontSize: type.display,
    fontWeight: '900',
    letterSpacing: 0,
  },
  surfaceCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
});
