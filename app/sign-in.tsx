import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, type } from '@/constants/design';

export default function SignInScreen() {
  const [studentId, setStudentId] = useState('UG/CS/2021/0042');
  const [password, setPassword] = useState('password');
  const [showPassword, setShowPassword] = useState(false);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', default: undefined })}
        style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.topRow}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Feather color={palette.mutedStrong} name="chevron-left" size={18} />
            </Pressable>
            <View style={styles.topDivider} />
            <Text style={styles.topLabel}>STUDENT AUTH</Text>
          </View>

          <View style={styles.authIconBox}>
            <Feather color={palette.teal} name="user" size={24} />
          </View>

          <Text style={styles.title}>Student Sign In</Text>
          <Text style={styles.subtitle}>Use your KNUST student credentials</Text>

          <View style={styles.formBlock}>
            <Text style={styles.fieldLabel}>STUDENT ID</Text>
            <TextInput
              autoCapitalize="characters"
              autoCorrect={false}
              onChangeText={setStudentId}
              placeholder="UG/CS/2021/0042"
              placeholderTextColor="#547099"
              style={styles.input}
              value={studentId}
            />

            <Text style={styles.fieldLabel}>PASSWORD</Text>
            <View style={styles.passwordField}>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor="#547099"
                secureTextEntry={!showPassword}
                style={styles.passwordInput}
                value={password}
              />
              <Pressable hitSlop={10} onPress={() => setShowPassword((value) => !value)}>
                <Feather
                  color={palette.muted}
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={18}
                />
              </Pressable>
            </View>
          </View>

          <View style={styles.noticeCard}>
            <View style={styles.noticeDot} />
            <Text style={styles.noticeCopy}>
              Camera and microphone access required for proctoring. Ensure you&apos;re in a well-lit,
              quiet space.
            </Text>
          </View>

          <Pressable onPress={() => router.replace('/(tabs)')} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Authenticate</Text>
          </Pressable>

          <Text style={styles.supportCopy}>
            Trouble signing in? <Text style={styles.supportAccent}>Contact IT support</Text>
          </Text>

          <View style={styles.footerSpacer} />

          <View style={styles.securityBar}>
            <Text style={styles.securityLabel}>SECURE CHANNEL</Text>
            <View style={styles.securityState}>
              <View style={styles.securityDot} />
              <Text style={styles.securityText}>TLS 1.3</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  authIconBox: {
    alignItems: 'center',
    borderColor: palette.teal,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    marginTop: 28,
    width: 42,
  },
  backButton: {
    alignItems: 'center',
    borderColor: palette.border,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 12,
    paddingHorizontal: 18,
  },
  fieldLabel: {
    color: palette.mutedStrong,
    fontSize: type.label,
    letterSpacing: 2.1,
    marginBottom: 10,
  },
  footerSpacer: {
    flex: 1,
    minHeight: 170,
  },
  formBlock: {
    gap: 14,
    marginTop: 32,
  },
  input: {
    backgroundColor: palette.panel,
    borderColor: palette.border,
    borderWidth: 1,
    color: palette.text,
    fontSize: 19,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  noticeCard: {
    backgroundColor: '#07262e',
    borderColor: '#0e626d',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 22,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  noticeCopy: {
    color: palette.mutedStrong,
    flex: 1,
    fontSize: 15,
    lineHeight: 24,
  },
  noticeDot: {
    backgroundColor: palette.teal,
    borderRadius: 99,
    height: 4,
    marginTop: 8,
    width: 4,
  },
  passwordField: {
    alignItems: 'center',
    backgroundColor: palette.panel,
    borderColor: palette.border,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
  },
  passwordInput: {
    color: palette.text,
    flex: 1,
    fontSize: 19,
    paddingVertical: 14,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#39d3ca',
    marginTop: 28,
    paddingVertical: 16,
  },
  primaryButtonText: {
    color: '#041218',
    fontSize: 17,
    fontWeight: '800',
  },
  safeArea: {
    backgroundColor: palette.background,
    flex: 1,
  },
  securityBar: {
    alignItems: 'center',
    backgroundColor: palette.panel,
    borderColor: palette.border,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  securityDot: {
    backgroundColor: palette.success,
    borderRadius: 99,
    height: 6,
    width: 6,
  },
  securityLabel: {
    color: palette.mutedStrong,
    fontSize: type.tiny,
    letterSpacing: 1.4,
  },
  securityState: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  securityText: {
    color: palette.success,
    fontSize: type.label,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  subtitle: {
    color: '#6f88aa',
    fontSize: 16,
    marginTop: 10,
  },
  supportAccent: {
    color: palette.teal,
    fontWeight: '700',
  },
  supportCopy: {
    color: palette.mutedStrong,
    fontSize: 15,
    marginTop: 18,
    textAlign: 'center',
  },
  title: {
    color: palette.text,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 28,
  },
  topDivider: {
    backgroundColor: palette.border,
    height: 20,
    width: 1,
  },
  topLabel: {
    color: palette.mutedStrong,
    fontSize: type.label,
    letterSpacing: 2.3,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
});
