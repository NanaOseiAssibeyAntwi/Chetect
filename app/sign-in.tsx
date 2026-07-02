import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
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

import { layout, palette, type } from '@/constants/design';
import { signInStudent } from '@/lib/student-auth';

export default function SignInScreen() {
  const [studentId, setStudentId] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleStudentSignIn = async () => {
    setErrorMessage('');
    setIsLoading(true);

    try {
      await signInStudent(studentId, password);
      router.replace('/(tabs)');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Sign-in failed. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

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
            <Text style={styles.topLabel}>KNUST STUDENT AUTH</Text>
          </View>

          <View style={styles.authIconBox}>
            <MaterialCommunityIcons color={palette.teal} name="account-school-outline" size={22} />
          </View>

          <Text style={styles.title}>Student Sign In</Text>
          <Text style={styles.subtitle}>Secure login for monitored exam sessions</Text>

          <View style={styles.formBlock}>
            <Text style={styles.fieldLabel}>STUDENT ID</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setStudentId}
              placeholder="Student ID or username"
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
                <Feather color={palette.muted} name={showPassword ? 'eye-off' : 'eye'} size={18} />
              </Pressable>
            </View>
          </View>

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <View style={styles.verificationCard}>
            <View style={styles.verificationLeft}>
              <MaterialCommunityIcons color={palette.teal} name="shield-check-outline" size={22} />
              <View>
                <Text style={styles.verificationTitle}>Identity Verification</Text>
                <Text style={styles.verificationMeta}>PROFILE + SESSION CHECK</Text>
              </View>
            </View>
            <View style={styles.verificationDot} />
          </View>

          <Pressable
            disabled={isLoading}
            onPress={handleStudentSignIn}
            style={({ pressed }) => [styles.primaryButton, (pressed || isLoading) && styles.primaryButtonPressed]}>
            {isLoading ? (
              <ActivityIndicator color="#03221a" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Authenticate</Text>
            )}
          </Pressable>

          <Text style={styles.supportCopy}>
            Need help? <Text style={styles.supportAccent}>Contact KNUST IT Support</Text>
          </Text>

          <View style={styles.footerSpacer} />

          <View style={styles.securityBar}>
            <Text style={styles.securityLabel}>ACCESS LEVEL</Text>
            <Text style={styles.securityText}>STUDENT - L1</Text>
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
    height: 40,
    justifyContent: 'center',
    marginTop: 22,
    width: 40,
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
    alignSelf: 'center',
    flexGrow: 1,
    maxWidth: layout.maxWidth,
    paddingBottom: 12,
    paddingHorizontal: layout.screenPadding,
    width: '100%',
  },
  errorText: {
    color: '#ff8f8f',
    fontSize: type.body,
    marginTop: 16,
  },
  fieldLabel: {
    color: palette.mutedStrong,
    fontSize: type.label,
    letterSpacing: 1.9,
    marginBottom: 8,
  },
  footerSpacer: {
    flex: 1,
    minHeight: layout.footerSpacer + 12,
  },
  formBlock: {
    gap: 14,
    marginTop: 26,
  },
  input: {
    backgroundColor: palette.panel,
    borderColor: palette.border,
    borderWidth: 1,
    color: palette.text,
    fontSize: type.bodyLarge,
    paddingHorizontal: 14,
    paddingVertical: 12,
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
    fontSize: type.bodyLarge,
    paddingVertical: 12,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#17c9a4',
    marginTop: 24,
    minHeight: 48,
    justifyContent: 'center',
  },
  primaryButtonPressed: {
    opacity: 0.92,
  },
  primaryButtonText: {
    color: '#03221a',
    fontSize: type.bodyLarge,
    fontWeight: '800',
  },
  safeArea: {
    backgroundColor: palette.background,
    flex: 1,
  },
  securityBar: {
    alignItems: 'center',
    backgroundColor: palette.panel,
    borderColor: '#0f7a66',
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  securityLabel: {
    color: '#38dfbb',
    fontSize: type.tiny,
    letterSpacing: 1.4,
  },
  securityText: {
    color: '#38dfbb',
    fontSize: type.label,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  subtitle: {
    color: '#6f88aa',
    fontSize: type.subtitle,
    marginTop: 8,
  },
  supportAccent: {
    color: '#38dfbb',
    fontWeight: '700',
  },
  supportCopy: {
    color: palette.mutedStrong,
    fontSize: type.body,
    marginTop: 16,
    textAlign: 'center',
  },
  title: {
    color: palette.text,
    fontSize: type.title + 1,
    fontWeight: '800',
    marginTop: 22,
  },
  topDivider: {
    backgroundColor: palette.border,
    height: 20,
    width: 1,
  },
  topLabel: {
    color: palette.mutedStrong,
    fontSize: type.label,
    letterSpacing: 2,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  verificationCard: {
    alignItems: 'center',
    backgroundColor: palette.panel,
    borderColor: palette.border,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  verificationDot: {
    backgroundColor: palette.success,
    borderRadius: 99,
    height: 6,
    width: 6,
  },
  verificationLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  verificationMeta: {
    color: palette.mutedStrong,
    fontSize: type.tiny,
    letterSpacing: 1.4,
    marginTop: 4,
  },
  verificationTitle: {
    color: palette.text,
    fontSize: 17,
    fontWeight: '700',
  },
});

