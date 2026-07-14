import { Feather } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
  View,
} from 'react-native';

import { entryAccents, type EntryAccent } from '@/components/entry-shell';
import { font, palette, radius, type } from '@/constants/design';

type EntryHeaderBarProps = {
  accent?: EntryAccent;
  label: string;
  onBack?: PressableProps['onPress'];
};

type EntryFieldProps = TextInputProps & {
  accent?: EntryAccent;
  icon: ReactNode;
  label: string;
  shellStyle?: StyleProp<ViewStyle>;
  trailing?: ReactNode;
};

type EntryPrimaryActionProps = {
  accent?: EntryAccent;
  disabled?: boolean;
  isLoading?: boolean;
  label: string;
  onPress?: PressableProps['onPress'];
};

export function EntryHeaderBar({
  accent = 'teal',
  label,
  onBack,
}: EntryHeaderBarProps) {
  const tone = entryAccents[accent];

  return (
    <View style={styles.headerRow}>
      <Pressable
        accessibilityLabel="Go back"
        accessibilityRole="button"
        hitSlop={10}
        onPress={onBack}
        style={({ pressed }) => [
          styles.backButton,
          {
            backgroundColor: tone.soft,
            borderColor: tone.border,
          },
          pressed ? styles.pressed : null,
        ]}>
        <Feather color={tone.accent} name="chevron-left" size={20} />
      </Pressable>
      <Text style={[styles.headerLabel, { color: tone.accent }]}>{label}</Text>
    </View>
  );
}

export function EntryField({
  accent = 'teal',
  icon,
  label,
  shellStyle,
  style,
  trailing,
  ...textInputProps
}: EntryFieldProps) {
  const tone = entryAccents[accent];

  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View
        style={[
          styles.fieldShell,
          {
            borderColor: tone.border,
          },
          shellStyle,
        ]}>
        <View style={styles.fieldIcon}>{icon}</View>
        <TextInput
          placeholderTextColor={palette.muted}
          selectionColor={tone.accent}
          style={[styles.fieldInput, style as StyleProp<TextStyle>]}
          {...textInputProps}
        />
        {trailing ? <View style={styles.fieldTrailing}>{trailing}</View> : null}
      </View>
    </View>
  );
}

export function EntryPrimaryAction({
  accent = 'teal',
  disabled = false,
  isLoading = false,
  label,
  onPress,
}: EntryPrimaryActionProps) {
  const tone = entryAccents[accent];

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || isLoading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        {
          backgroundColor: tone.accent,
          borderColor: tone.border,
        },
        (pressed || disabled || isLoading) ? styles.pressed : null,
      ]}>
      {isLoading ? (
        <ActivityIndicator color={tone.accentContrast} size="small" />
      ) : (
        <Text style={[styles.primaryButtonText, { color: tone.accentContrast }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  fieldBlock: {
    gap: 10,
  },
  fieldIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
  },
  fieldInput: {
    color: palette.text,
    flex: 1,
    fontFamily: font.body,
    fontSize: type.bodyLarge,
    minHeight: 52,
    paddingVertical: 14,
  },
  fieldLabel: {
    color: palette.mutedStrong,
    fontFamily: font.body,
    fontSize: type.tiny,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  fieldShell: {
    alignItems: 'center',
    backgroundColor: palette.panel,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 16,
  },
  fieldTrailing: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLabel: {
    fontFamily: font.body,
    fontSize: type.label,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  pressed: {
    opacity: 0.94,
    transform: [{ scale: 0.992 }],
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    fontFamily: font.body,
    fontSize: type.bodyLarge,
    fontWeight: '900',
    letterSpacing: 0,
  },
});
