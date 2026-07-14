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

import { layout, palette, radius, shadow, type } from '@/constants/design';
import { signInInvigilator } from '@/lib/student-auth';

export default function InvigilatorSignInScreen() {
  const [staffId, setStaffId] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleInvigilatorSignIn = async () => {
    setErrorMessage('');
    setIsLoading(true);

    try {
      await signInInvigilator(staffId, password);
      router.replace('/(invigilator-tabs)');
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
            <Text style={styles.topLabel}>Invigilator access</Text>
          </View>

          <View style={styles.authIconBox}>
            <MaterialCommunityIcons color={palette.warning} name="lock-outline" size={22} />
          </View>

          <Text style={styles.title}>Invigilator Sign In</Text>
          <Text style={styles.subtitle}>Staff credentials - elevated access</Text>

          <View style={styles.formBlock}>
            <Text style={styles.fieldLabel}>STAFF ID</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setStaffId}
              placeholder="Staff ID or username"
              placeholderTextColor={palette.muted}
              style={styles.input}
              value={staffId}
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
                <Feather
                  color={palette.muted}
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={18}
                />
              </Pressable>
            </View>
          </View>

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <View style={styles.biometricCard}>
            <View style={styles.biometricLeft}>
              <MaterialCommunityIcons color={palette.warning} name="fingerprint" size={22} />
              <View>
                <Text style={styles.biometricTitle}>Biometric Login</Text>
                <Text style={styles.biometricMeta}>TOUCH ID / FACE ID</Text>
              </View>
            </View>
            <View style={styles.biometricDot} />
          </View>

          <Pressable
            disabled={isLoading}
            onPress={handleInvigilatorSignIn}
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
            <Text style={styles.securityText}>Invigilator</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  authIconBox: {
    alignItems: 'center',
    backgroundColor: palette.warningSoft,
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
  biometricCard: {
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
  biometricDot: {
    backgroundColor: palette.success,
    borderRadius: 99,
    height: 6,
    width: 6,
  },
  biometricLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  biometricMeta: {
    color: palette.mutedStrong,
    fontSize: type.tiny,
    letterSpacing: 1.4,
    marginTop: 4,
  },
  biometricTitle: {
    color: palette.text,
    fontSize: 17,
    fontWeight: '700',
  },
  content: {
    alignSelf: 'center',
    flexGrow: 1,
    paddingBottom: 12,
    paddingHorizontal: layout.screenPadding,
    maxWidth: layout.maxWidth,
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
    minHeight: 48,
    justifyContent: 'center',
    marginTop: 24,
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
});

