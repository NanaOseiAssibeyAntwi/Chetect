import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { BrandMark } from '@/components/brand-mark';
import { AccentBadge } from '@/components/product-ui';
import { font, palette, type } from '@/constants/design';

type BootSplashProps = {
  message?: string;
};

export function BootSplash({
  message = 'Preparing your secure exam workspace...',
}: BootSplashProps) {
  return (
    <AppScreen accent="teal" contentContainerStyle={styles.content} scroll={false}>
      <AccentBadge label="SYSTEM ONLINE" tone="primary" />
      <BrandMark size={74} />
      <View style={styles.copyBlock}>
        <Text style={styles.title}>Chetect</Text>
        <Text style={styles.subtitle}>Secure academic integrity for KNUST.</Text>
      </View>
      <View style={styles.statusRow}>
        <ActivityIndicator color={palette.teal} size="small" />
        <Text style={styles.statusText}>{message}</Text>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 48,
  },
  copyBlock: {
    alignItems: 'center',
    marginTop: 20,
  },
  statusRow: {
    alignItems: 'center',
    borderColor: palette.borderStrong,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 28,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  statusText: {
    color: palette.mutedStrong,
    fontFamily: font.body,
    fontSize: type.body,
  },
  subtitle: {
    color: palette.mutedStrong,
    fontFamily: font.body,
    fontSize: type.bodyLarge,
    marginTop: 10,
    textAlign: 'center',
  },
  title: {
    color: palette.text,
    fontFamily: font.display,
    fontSize: type.display + 2,
    fontWeight: '900',
    letterSpacing: -1,
    marginTop: 20,
  },
});
