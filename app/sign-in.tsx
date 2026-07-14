import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
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

import { layout, palette, radius, shadow, type } from '@/constants/design';
import { signInStudent } from '@/lib/student-auth';

export default function SignInScreen() {
  const [studentId, setStudentId] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const returnToLanding = useCallback(() => {
    router.replace('/');
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      returnToLanding();
      return true;
    });

    return () => {
      subscription.remove();
    };
  }, [returnToLanding]);

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
            <Pressable onPress={returnToLanding} style={styles.backButton}>
              <Feather color={palette.mutedStrong} name="chevron-left" size={18} />
            </Pressable>
            <Text style={styles.topLabel}>Student access</Text>
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
              placeholderTextColor={palette.muted}
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
                placeholderTextColor={palette.muted}
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
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Authenticate</Text>
            )}
          </Pressable>

          <View style={styles.footerSpacer} />

          <View style={styles.securityBar}>
            <Text style={styles.securityLabel}>Access level</Text>
            <Text style={styles.securityText}>Student</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  authIconBox: {
    alignItems: 'center',
    backgroundColor: palette.tealSoft,
    borderRadius: radius.md,
    height: 44,
    justifyContent: 'center',
    marginTop: 22,
    width: 44,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: palette.panel,
    borderColor: palette.border,
    borderRadius: radius.md,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
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
    color: palette.danger,
    fontSize: type.body,
    marginTop: 16,
  },
  fieldLabel: {
    color: palette.mutedStrong,
    fontSize: type.label,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: 'uppercase',
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
    borderRadius: radius.md,
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
    borderRadius: radius.md,
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
    backgroundColor: palette.teal,
    borderRadius: radius.md,
    marginTop: 24,
    minHeight: 48,
    justifyContent: 'center',
  },
  primaryButtonPressed: {
    opacity: 0.92,
  },
  primaryButtonText: {
    color: '#ffffff',
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
    borderColor: palette.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...shadow.card,
  },
  securityLabel: {
    color: palette.mutedStrong,
    fontSize: type.body,
  },
  securityText: {
    color: palette.text,
    fontSize: type.body,
    fontWeight: '700',
  },
  subtitle: {
    color: palette.mutedStrong,
    fontSize: type.subtitle,
    marginTop: 8,
  },
  title: {
    color: palette.text,
    fontSize: type.display,
    fontWeight: '800',
    marginTop: 22,
  },
  topLabel: {
    color: palette.mutedStrong,
    fontSize: type.body,
    fontWeight: '700',
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
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...shadow.card,
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
    letterSpacing: 0.4,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  verificationTitle: {
    color: palette.text,
    fontSize: 17,
    fontWeight: '700',
  },
});

