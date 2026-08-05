import { Feather } from '@expo/vector-icons';
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
import { layout, radius, type } from '@/constants/design';
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
    <AppScreen contentContainerStyle={styles.content} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.navigate('/(tabs)/profile')} style={styles.backButton}>
          <Feather color={colors.mutedStrong} name="chevron-left" size={18} />
        </Pressable>
        <Text style={styles.eyebrow}>CHANGE PASSWORD</Text>
      </View>

      <SurfaceCard style={styles.formCard}>
        <View style={styles.formHeader}>
          <Text style={styles.title}>Update Password</Text>
          <Pressable
            hitSlop={10}
            onPress={() => setShowPasswords((value) => !value)}
            style={styles.eyeButton}>
            <Feather color={colors.mutedStrong} name={showPasswords ? 'eye-off' : 'eye'} size={18} />
          </Pressable>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>CURRENT PASSWORD</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setCurrentPassword}
            placeholder="Current password"
            placeholderTextColor={colors.muted}
            secureTextEntry={!showPasswords}
            style={styles.input}
            value={currentPassword}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>NEW PASSWORD</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setNewPassword}
            placeholder="At least 8 characters"
            placeholderTextColor={colors.muted}
            secureTextEntry={!showPasswords}
            style={styles.input}
            value={newPassword}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>CONFIRM NEW PASSWORD</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setConfirmPassword}
            placeholder="Confirm new password"
            placeholderTextColor={colors.muted}
            secureTextEntry={!showPasswords}
            style={styles.input}
            value={confirmPassword}
          />
        </View>
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
        icon={isSaving ? <ActivityIndicator color={colors.background} size="small" /> : undefined}
        label={isSaving ? '' : 'Save Password'}
        onPress={handleSubmit}
        tone="primary"
      />
    </AppScreen>
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
      height: 28,
      justifyContent: 'center',
      width: 28,
    },
    content: {
      paddingBottom: layout.bottomPadding,
    },
    eyebrow: {
      color: colors.mutedStrong,
      fontSize: type.label,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    eyeButton: {
      alignItems: 'center',
      backgroundColor: colors.panelSoft,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      height: 38,
      justifyContent: 'center',
      width: 38,
    },
    fieldGroup: {
      marginTop: 18,
    },
    formCard: {
      marginTop: 18,
    },
    formHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    headerRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    input: {
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      color: colors.text,
      fontSize: type.bodyLarge,
      marginTop: 10,
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    label: {
      color: colors.mutedStrong,
      fontSize: type.label,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    message: {
      marginTop: 14,
    },
    submitButton: {
      marginTop: 18,
    },
    title: {
      color: colors.text,
      fontSize: type.title + 2,
      fontWeight: '800',
    },
  });
}
