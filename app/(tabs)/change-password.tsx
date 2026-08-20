import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { ActionButton, InlineMessage, SurfaceCard } from '@/components/product-ui';
import { layout, radius, shadow, type } from '@/constants/design';
import { useAppTheme } from '@/hooks/use-app-theme';
import { changeStudentPassword } from '@/lib/student-profile';

export default function ChangePasswordScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    if (newPassword !== confirmPassword) {
      setErrorMessage('New password and confirmation do not match.');
      return;
    }

    setIsSaving(true);

    try {
      await changeStudentPassword({
        currentPassword,
        newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccessMessage('Password changed successfully.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to change password.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppScreen accent="teal" contentContainerStyle={styles.content} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.navigate('/(tabs)/profile')} style={styles.backButton}>
          <Feather color={colors.mutedStrong} name="chevron-left" size={18} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>SECURITY</Text>
          <Text style={styles.headerTitle}>Change password</Text>
        </View>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroIcon}>
          <MaterialCommunityIcons color={colors.teal} name="lock-reset" size={24} />
        </View>
        <View style={styles.heroText}>
          <Text style={styles.title}>Update your sign-in password</Text>
          <Text style={styles.meta}>Use a private password that is not shared with another account.</Text>
        </View>
      </View>

      <SurfaceCard style={styles.formCard} tone="muted">
        <View style={styles.formHeader}>
          <Text style={styles.formTitle}>Password details</Text>
          <Pressable
            hitSlop={10}
            onPress={() => setShowPasswords((value) => !value)}
            style={({ pressed }) => [styles.eyeButton, pressed ? styles.buttonPressed : null]}>
            <Feather color={colors.mutedStrong} name={showPasswords ? 'eye-off' : 'eye'} size={18} />
          </Pressable>
        </View>

        <PasswordField
          label="Current Password"
          onChangeText={setCurrentPassword}
          placeholder="Current password"
          secure={!showPasswords}
          styles={styles}
          value={currentPassword}
          colors={colors}
        />
        <PasswordField
          label="New Password"
          onChangeText={setNewPassword}
          placeholder="At least 8 characters"
          secure={!showPasswords}
          styles={styles}
          value={newPassword}
          colors={colors}
        />
        <PasswordField
          label="Confirm New Password"
          onChangeText={setConfirmPassword}
          placeholder="Confirm new password"
          secure={!showPasswords}
          styles={styles}
          value={confirmPassword}
          colors={colors}
        />
      </SurfaceCard>

      {errorMessage ? (
        <InlineMessage description={errorMessage} style={styles.message} tone="danger" />
      ) : null}
      {successMessage ? (
        <InlineMessage description={successMessage} style={styles.message} tone="success" />
      ) : null}

      <ActionButton
        containerStyle={styles.submitButton}
        disabled={isSaving}
        icon={isSaving ? <ActivityIndicator color="#ffffff" size="small" /> : <Feather color="#ffffff" name="save" size={15} />}
        label={isSaving ? '' : 'Save Password'}
        onPress={handleSubmit}
        tone="primary"
      />
    </AppScreen>
  );
}

function PasswordField({
  colors,
  label,
  onChangeText,
  placeholder,
  secure,
  styles,
  value,
}: {
  colors: ReturnType<typeof useAppTheme>['colors'];
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secure: boolean;
  styles: ReturnType<typeof createStyles>;
  value: string;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        secureTextEntry={secure}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    backButton: {
      alignItems: 'center',
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      height: 34,
      justifyContent: 'center',
      width: 34,
    },
    buttonPressed: {
      opacity: 0.88,
      transform: [{ scale: 0.98 }],
    },
    content: {
      paddingBottom: layout.bottomPadding,
    },
    eyebrow: {
      color: colors.teal,
      fontSize: type.tiny,
      fontWeight: '900',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    eyeButton: {
      alignItems: 'center',
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      height: 38,
      justifyContent: 'center',
      width: 38,
    },
    fieldGroup: {
      marginTop: 16,
    },
    formCard: {
      marginTop: 16,
    },
    formHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    formTitle: {
      color: colors.text,
      fontSize: type.bodyLarge,
      fontWeight: '900',
    },
    headerRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    headerText: {
      flex: 1,
      gap: 3,
    },
    headerTitle: {
      color: colors.text,
      fontSize: type.bodyLarge,
      fontWeight: '900',
    },
    heroCard: {
      alignItems: 'center',
      backgroundColor: colors.panel,
      borderColor: colors.borderStrong,
      borderRadius: radius.lg,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 13,
      marginTop: 16,
      paddingHorizontal: 16,
      paddingVertical: 15,
      ...shadow.raised,
    },
    heroIcon: {
      alignItems: 'center',
      backgroundColor: colors.tealSoft,
      borderColor: colors.tealGlow,
      borderRadius: radius.md,
      borderWidth: 1,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    heroText: {
      flex: 1,
      minWidth: 0,
    },
    input: {
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      color: colors.text,
      fontSize: type.bodyLarge,
      marginTop: 8,
      minHeight: 48,
      paddingHorizontal: 14,
    },
    label: {
      color: colors.mutedStrong,
      fontSize: type.tiny,
      fontWeight: '900',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    message: {
      marginTop: 14,
    },
    meta: {
      color: colors.mutedStrong,
      fontSize: type.body,
      lineHeight: 20,
      marginTop: 5,
    },
    submitButton: {
      marginTop: 18,
    },
    title: {
      color: colors.text,
      fontSize: type.title,
      fontWeight: '900',
    },
  });
}
