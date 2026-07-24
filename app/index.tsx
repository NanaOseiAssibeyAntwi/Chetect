import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { layout, radius, shadow, type } from '@/constants/design';

const landingColors = {
  background: '#f7f8fb',
  blue: '#2f5fbf',
  blueDark: '#1f3d7a',
  blueLine: '#c7d8f8',
  emerald: '#0f766e',
  emeraldSoft: '#eefbf7',
  gold: '#9a6a21',
  goldDark: '#7c4f14',
  goldLine: '#ead2ad',
  ink: '#101828',
  muted: '#5f6b7a',
  navy: '#18243a',
  wash: '#f0f3f8',
};

const roles = [
  {
    accent: landingColors.blue,
    arrowBackground: landingColors.blueDark,
    arrowColor: '#ffffff',
    background: '#f8fbff',
    border: landingColors.blueLine,
    description: 'Enter scheduled exams and view your session records.',
    fill: landingColors.blue,
    href: '/sign-in' as const,
    icon: <Feather color="#ffffff" name="user-check" size={22} />,
    meta: 'Student portal',
    title: 'Student',
  },
  {
    accent: landingColors.gold,
    arrowBackground: landingColors.goldDark,
    arrowColor: '#ffffff',
    background: '#fffaf2',
    border: landingColors.goldLine,
    description: 'Create sessions, monitor activity, and review alerts.',
    fill: landingColors.gold,
    href: '/invigilator-sign-in' as const,
    icon: <MaterialCommunityIcons color="#ffffff" name="shield-account-outline" size={23} />,
    meta: 'Staff portal',
    title: 'Invigilator',
  },
] as const;

export default function LandingScreen() {
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View pointerEvents="none" style={styles.backgroundLayer}>
        <View style={styles.topWash} />
        <View style={styles.bluePlane} />
        <View style={styles.goldPlane} />
        <View style={styles.lowerWash} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroBlock}>
          <View style={styles.brandStage}>
            <View style={styles.brandPlateBack} />
            <View style={styles.brandMark}>
              <MaterialCommunityIcons color="#ffffff" name="shield-check-outline" size={34} />
            </View>
          </View>

          <Text style={styles.brandLabel}>KNUST exam access</Text>
          <Text style={styles.heroLine}>Chetect</Text>
          <Text style={styles.heroCopy}>Secure exam entry for students and invigilators.</Text>
        </View>

        <View style={styles.selectorHeader}>
          <Text style={styles.sectionLabel}>Continue as</Text>
        </View>

        <View style={styles.roleList}>
          {roles.map((role) => (
            <Pressable
              key={role.title}
              android_ripple={{ color: role.border }}
              onPress={() => router.push(role.href)}
              style={({ pressed }) => [
                styles.roleCard,
                { backgroundColor: role.background, borderColor: role.border },
                pressed && styles.roleCardPressed,
              ]}>
              <View style={[styles.roleAccent, { backgroundColor: role.accent }]} />
              <View style={[styles.roleIconBox, { backgroundColor: role.fill }]}>
                {role.icon}
              </View>
              <View style={styles.roleTextBlock}>
                <View style={[styles.roleMetaPill, { borderColor: role.border }]}>
                  <Text style={[styles.roleMeta, { color: role.accent }]}>{role.meta}</Text>
                </View>
                <Text style={styles.roleTitle}>{role.title}</Text>
                <Text style={styles.roleDescription}>{role.description}</Text>
              </View>
              <View style={[styles.roleArrow, { backgroundColor: role.arrowBackground }]}>
                <Feather color={role.arrowColor} name="arrow-right" size={18} />
              </View>
            </Pressable>
          ))}
        </View>

        <View style={styles.footerPill}>
          <Feather color={landingColors.emerald} name="lock" size={13} />
          <Text style={styles.footerText}>Verified institutional access</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: landingColors.background,
    overflow: 'hidden',
  },
  bluePlane: {
    backgroundColor: '#e8eef8',
    height: 86,
    opacity: 0.55,
    position: 'absolute',
    right: -42,
    top: 62,
    transform: [{ rotate: '-14deg' }],
    width: 210,
  },
  brandLabel: {
    color: landingColors.blueDark,
    fontSize: type.body,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 18,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: landingColors.navy,
    borderColor: '#ffffff',
    borderRadius: 22,
    borderWidth: 3,
    height: 74,
    justifyContent: 'center',
    shadowColor: landingColors.blueDark,
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    width: 74,
  },
  brandPlateBack: {
    backgroundColor: '#f1d9b5',
    borderRadius: 18,
    height: 48,
    left: 30,
    position: 'absolute',
    top: 16,
    transform: [{ rotate: '12deg' }],
    width: 64,
  },
  brandStage: {
    alignItems: 'center',
    height: 86,
    justifyContent: 'center',
    width: 120,
  },
  content: {
    alignSelf: 'center',
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'flex-start',
    maxWidth: layout.maxWidth,
    paddingBottom: layout.bottomPadding + 6,
    paddingHorizontal: layout.screenPadding,
    paddingTop: 30,
    width: '100%',
  },
  footerPill: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: landingColors.emeraldSoft,
    borderColor: '#b7eadb',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  footerText: {
    color: landingColors.emerald,
    fontSize: type.body,
    fontWeight: '800',
  },
  goldPlane: {
    backgroundColor: '#f7ead8',
    height: 74,
    left: -48,
    opacity: 0.52,
    position: 'absolute',
    top: 164,
    transform: [{ rotate: '12deg' }],
    width: 190,
  },
  heroBlock: {
    alignItems: 'center',
    marginBottom: 26,
    paddingTop: 8,
    width: '100%',
  },
  heroCopy: {
    color: landingColors.muted,
    fontSize: type.bodyLarge,
    lineHeight: 22,
    marginTop: 8,
    maxWidth: 280,
    textAlign: 'center',
  },
  heroLine: {
    color: landingColors.ink,
    fontSize: type.hero + 4,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: type.hero + 10,
    textAlign: 'center',
  },
  lowerWash: {
    backgroundColor: landingColors.wash,
    bottom: -80,
    height: 220,
    left: -20,
    opacity: 0.5,
    position: 'absolute',
    right: -20,
  },
  roleAccent: {
    borderBottomLeftRadius: radius.md,
    borderTopLeftRadius: radius.md,
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
    width: 3,
  },
  roleArrow: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 38,
    justifyContent: 'center',
    shadowColor: landingColors.ink,
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.13,
    shadowRadius: 10,
    width: 38,
  },
  roleCard: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 13,
    minHeight: 108,
    overflow: 'hidden',
    paddingBottom: 15,
    paddingLeft: 19,
    paddingRight: 13,
    paddingTop: 15,
    ...shadow.card,
  },
  roleCardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.995 }],
  },
  roleDescription: {
    color: landingColors.muted,
    fontSize: type.body,
    lineHeight: 18,
  },
  roleMeta: {
    fontSize: type.tiny,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  roleMetaPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.84)',
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  roleIconBox: {
    alignItems: 'center',
    borderRadius: 16,
    height: 50,
    justifyContent: 'center',
    shadowColor: landingColors.ink,
    shadowOffset: { height: 7, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    width: 50,
  },
  roleList: {
    gap: 12,
    width: '100%',
  },
  roleTextBlock: {
    flex: 1,
    gap: 5,
  },
  roleTitle: {
    color: landingColors.ink,
    fontSize: type.title + 1,
    fontWeight: '800',
  },
  safeArea: {
    backgroundColor: landingColors.background,
    flex: 1,
  },
  selectorHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionLabel: {
    color: landingColors.muted,
    fontSize: type.body,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  topWash: {
    backgroundColor: '#f3f6fb',
    height: 280,
    left: 0,
    opacity: 0.82,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
