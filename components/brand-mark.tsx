import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { palette, radius } from '@/constants/design';

type BrandMarkProps = {
  accent?: 'teal' | 'warning';
  size?: number;
};

export function BrandMark({ accent = 'teal', size = 58 }: BrandMarkProps) {
  const tone = accent === 'warning' ? palette.warning : palette.teal;

  return (
    <View
      style={[
        styles.shell,
        {
          borderColor: tone,
          borderRadius: radius.md,
          height: size,
          width: size,
        },
      ]}>
      <MaterialCommunityIcons color={tone} name="shield-lock-outline" size={size * 0.46} />
      <View style={[styles.dot, { backgroundColor: tone }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    borderRadius: radius.pill,
    height: 6,
    position: 'absolute',
    right: 8,
    top: 8,
    width: 6,
  },
  shell: {
    alignItems: 'center',
    backgroundColor: palette.panelSoft,
    borderWidth: 1,
    justifyContent: 'center',
  },
});
