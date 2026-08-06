import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { radius } from '@/constants/design';
import { useAppTheme } from '@/hooks/use-app-theme';

type BrandMarkProps = {
  accent?: 'teal' | 'warning';
  size?: number;
};

export function BrandMark({ accent = 'teal', size = 58 }: BrandMarkProps) {
  const { colors } = useAppTheme();
  const shellColor = accent === 'warning' ? colors.warning : colors.teal;
  const markerColor = accent === 'warning' ? colors.teal : colors.warning;

  return (
    <View
      style={[
        styles.shell,
        {
          backgroundColor: shellColor,
          borderColor: colors.tealGlow,
          borderRadius: radius.lg,
          height: size,
          width: size,
        },
      ]}>
      <MaterialCommunityIcons color="#ffffff" name="shield-lock-outline" size={size * 0.46} />
      <View style={[styles.dot, { backgroundColor: markerColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    borderRadius: radius.pill,
    height: 6,
    position: 'absolute',
    right: 10,
    top: 10,
    width: 6,
  },
  shell: {
    alignItems: 'center',
    borderWidth: 1,
    justifyContent: 'center',
  },
});
