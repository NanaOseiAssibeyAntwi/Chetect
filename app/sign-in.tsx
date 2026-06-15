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

import { layout, palette } from '@/constants/design';
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
              <Feather color={palette.mutedStrong} name="chevron-left" size={19} />
            </Pressable>
            <Text style={styles.topLabel}>KNUST STUDENT AUTH</Text>
          </View>

          <View style={styles.heroCard}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>CHE-TECT</Text>
            </View>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Secure login for KNUST exam monitoring</Text>

            <View style={styles.authIconBox}>
              <MaterialCommunityIcons color="#0c7668" name="shield-check-outline" size={24} />
            </View>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.fieldLabel}>STUDENT ID OR USERNAME</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setStudentId}
              placeholder="Student ID or username"
              placeholderTextColor="#94a3b8"
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
                placeholderTextColor="#94a3b8"
                secureTextEntry={!showPassword}
                style={styles.passwordInput}
                value={password}
              />
              <Pressable hitSlop={10} onPress={() => setShowPassword((value) => !value)}>
                <Feather color="#64748b" name={showPassword ? 'eye-off' : 'eye'} size={18} />
              </Pressable>
            </View>

            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

            <Pressable
              disabled={isLoading}
              onPress={handleStudentSignIn}
              style={({ pressed }) => [
                styles.primaryButton,
                (pressed || isLoading) && styles.primaryButtonPressed,
              ]}>
              {isLoading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Sign In</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.noticeCard}>
            <View style={styles.noticeDot} />
            <Text style={styles.noticeCopy}>
              Your identity is verified against your secured KNUST student profile before access is
              granted.
            </Text>
          </View>

          <Text style={styles.supportCopy}>
            Need help? <Text style={styles.supportAccent}>Contact KNUST IT Support</Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  authIconBox: {
    alignItems: 'center',
    backgroundColor: '#eef9f7',
    borderColor: '#bde7de',
    borderRadius: 16,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    marginTop: 14,
    width: 46,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: palette.panel,
    borderColor: palette.border,
    borderRadius: 10,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ecfeff',
    borderColor: '#bae6fd',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: {
    color: '#0f766e',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9,
  },
  content: {
    alignSelf: 'center',
    flexGrow: 1,
    maxWidth: layout.maxWidth,
    paddingBottom: 18,
    paddingHorizontal: layout.screenPadding,
    width: '100%',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
    marginTop: 12,
  },
  fieldLabel: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 8,
    marginTop: 16,
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderColor: '#dbe4ef',
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  heroCard: {
    backgroundColor: '#ffffff',
    borderColor: '#dbe4ef',
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderColor: '#dbe4ef',
    borderRadius: 12,
    borderWidth: 1,
    color: '#0f172a',
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  noticeCard: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  noticeCopy: {
    color: '#166534',
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  noticeDot: {
    backgroundColor: '#22c55e',
    borderRadius: 99,
    height: 6,
    marginTop: 6,
    width: 6,
  },
  passwordField: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderColor: '#dbe4ef',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
  },
  passwordInput: {
    color: '#0f172a',
    flex: 1,
    fontSize: 15,
    paddingVertical: 12,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#0f766e',
    borderRadius: 12,
    marginTop: 18,
    minHeight: 48,
    justifyContent: 'center',
  },
  primaryButtonPressed: {
    opacity: 0.92,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  safeArea: {
    backgroundColor: palette.background,
    flex: 1,
  },
  subtitle: {
    color: '#475569',
    fontSize: 14,
    marginTop: 8,
  },
  supportAccent: {
    color: '#0f766e',
    fontWeight: '700',
  },
  supportCopy: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 14,
    textAlign: 'center',
  },
  title: {
    color: '#0f172a',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 12,
  },
  topLabel: {
    color: palette.mutedStrong,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
});

