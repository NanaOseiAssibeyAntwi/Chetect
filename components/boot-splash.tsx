import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { BrandMark } from '@/components/brand-mark';
import { font, radius, type } from '@/constants/design';
import { useAppTheme } from '@/hooks/use-app-theme';

type BootSplashProps = {
  message?: string;
};

export function BootSplash({
  message = 'Preparing your secure exam workspace...',
}: BootSplashProps) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <BrandMark size={64} />
      <View style={styles.copyBlock}>
        <Text style={[styles.title, { color: colors.text }]}>Chetect</Text>
        <Text style={[styles.subtitle, { color: colors.mutedStrong }]}>
          Secure exam access for KNUST.
        </Text>
      </View>
      <View style={[styles.statusRow, { backgroundColor: colors.panel, borderColor: colors.borderStrong }]}>
        <ActivityIndicator color={colors.teal} size="small" />
        <Text style={[styles.statusText, { color: colors.mutedStrong }]}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 48,
    paddingHorizontal: 28,
  },
  copyBlock: {
    alignItems: 'center',
    marginTop: 18,
  },
  statusRow: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 26,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  statusText: {
    fontFamily: font.body,
    fontSize: type.body,
  },
  subtitle: {
    fontFamily: font.body,
    fontSize: type.bodyLarge,
    marginTop: 10,
    textAlign: 'center',
  },
  title: {
    fontFamily: font.display,
    fontSize: type.display + 2,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 20,
  },
});
