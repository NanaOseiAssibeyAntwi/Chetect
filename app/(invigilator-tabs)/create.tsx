import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton, InlineMessage, SurfaceCard } from '@/components/product-ui';
import { font, layout, radius, shadow, type } from '@/constants/design';
import { useAppTheme } from '@/hooks/use-app-theme';
import {
  createExamSession,
  type CreateExamQuestionInput,
  type CreateExamSessionInput,
} from '@/lib/invigilator-sessions';
import { clearScreenCache, clearScreenCacheByPrefix } from '@/lib/screen-cache';

type MonitoringMode = CreateExamSessionInput['monitoringMode'];

const monitoringModes = [
  {
    description: 'Gaze, face detection, app monitoring',
    title: 'Standard',
    value: 'standard',
  },
  {
    description: 'All standard + audio + room scan',
    title: 'Strict',
    value: 'strict',
  },
  {
    description: 'Face detection only',
    title: 'Minimal',
    value: 'minimal',
  },
] as const satisfies readonly {
  description: string;
  title: string;
  value: MonitoringMode;
}[];

const aiFeatures = [
  'Real-time gaze tracking',
  'Multi-face detection',
  'App switch detection',
  'Audio anomaly detection',
];

const MIN_OPTIONS_PER_QUESTION = 4;

function createEmptyQuestion(): CreateExamQuestionInput {
  return {
    correctOptionIndex: 0,
    options: Array.from({ length: MIN_OPTIONS_PER_QUESTION }, () => ''),
    prompt: '',
  };
}

function parseStudentInstitutionalIds(rawValue: string) {
  return Array.from(
    new Set(
      rawValue
        .split(/[\s,]+/)
        .map((entry) => entry.trim())
        .filter(Boolean)
    )
  );
}

function normalizeQuestionsForSubmit(questions: CreateExamQuestionInput[]) {
  return questions
    .map((question) => ({
      ...question,
      options: question.options.map((option) => option.trim()),
      prompt: question.prompt.trim(),
    }))
    .filter((question) => question.prompt || question.options.some((option) => option));
}

export default function InvigilatorCreateScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [courseCode, setCourseCode] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [examDate, setExamDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [durationHours, setDurationHours] = useState('3');
  const [maxStudents, setMaxStudents] = useState('50');
  const [studentIdsInput, setStudentIdsInput] = useState('');
  const [questions, setQuestions] = useState<CreateExamQuestionInput[]>([createEmptyQuestion()]);
  const [mode, setMode] = useState<MonitoringMode>('standard');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const updateQuestionPrompt = (index: number, prompt: string) => {
    setQuestions((current) =>
      current.map((question, questionIndex) =>
        questionIndex === index ? { ...question, prompt } : question
      )
    );
  };

  const updateQuestionOption = (questionIndex: number, optionIndex: number, optionValue: string) => {
    setQuestions((current) =>
      current.map((question, currentQuestionIndex) => {
        if (currentQuestionIndex !== questionIndex) {
          return question;
        }

        return {
          ...question,
          options: question.options.map((option, currentOptionIndex) =>
            currentOptionIndex === optionIndex ? optionValue : option
          ),
        };
      })
    );
  };

  const updateQuestionCorrectOption = (questionIndex: number, optionIndex: number) => {
    setQuestions((current) =>
      current.map((question, currentQuestionIndex) =>
        currentQuestionIndex === questionIndex ? { ...question, correctOptionIndex: optionIndex } : question
      )
    );
  };

  const addQuestion = () => {
    setQuestions((current) => [...current, createEmptyQuestion()]);
  };

  const removeQuestion = (questionIndex: number) => {
    setQuestions((current) => {
      if (current.length === 1) {
        return [createEmptyQuestion()];
      }

      return current.filter((_, index) => index !== questionIndex);
    });
  };

  const handleCreateSession = async () => {
    setErrorMessage('');
    setIsSaving(true);

    try {
      const requestedStudentIds = parseStudentInstitutionalIds(studentIdsInput);
      const parsedQuestions = normalizeQuestionsForSubmit(questions);
      const result = await createExamSession({
        courseCode,
        courseTitle,
        durationHours: Number(durationHours),
        examDate,
        maxStudents: Number(maxStudents),
        monitoringMode: mode,
        questions: parsedQuestions,
        startTime,
        studentInstitutionalIds: requestedStudentIds,
      });

      clearScreenCache('invigilator.dashboard');
      clearScreenCache('invigilator.audit-history');
      clearScreenCache('invigilator.profile');
      clearScreenCache('invigilator.reports');
      clearScreenCacheByPrefix('invigilator.monitor');

      router.replace({
        pathname: '/(invigilator-tabs)/session-details',
        params: {
          examId: result.examId,
          missingStudentIds: result.missingStudentIds.join(','),
        },
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to create session. Please try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.headerRow}>
            <View style={styles.eyebrowPill}>
              <View style={styles.eyebrowDot} />
              <Text style={styles.eyebrow}>NEW SESSION</Text>
            </View>
          </View>

          <View style={styles.heroBody}>
            <View style={styles.heroText}>
              <Text style={styles.title}>Create Exam Session</Text>
              <Text style={styles.subtitle}>Set the schedule, students, questions, and monitoring level.</Text>
            </View>
            <View style={styles.heroIcon}>
              <Feather color={colors.warning} name="plus" size={25} />
            </View>
          </View>
        </View>

        <SurfaceCard style={styles.sectionCard}>
          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionTitle}>Session details</Text>
              <Text style={styles.sectionMeta}>Course, timing, and registrations</Text>
            </View>
            <Feather color={colors.mutedStrong} name="calendar" size={18} />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>COURSE CODE</Text>
            <TextInput
              autoCapitalize="characters"
              autoCorrect={false}
              onChangeText={setCourseCode}
              placeholder="CS 450"
              placeholderTextColor={colors.muted}
              style={styles.input}
              value={courseCode}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>COURSE NAME</Text>
            <TextInput
              autoCapitalize="words"
              autoCorrect={false}
              onChangeText={setCourseTitle}
              placeholder="Computer Networks"
              placeholderTextColor={colors.muted}
              style={styles.input}
              value={courseTitle}
            />
          </View>

          <View style={styles.twoUp}>
            <View style={styles.twoUpItem}>
              <Text style={styles.label}>DATE</Text>
              <View style={styles.inputWithIcon}>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={setExamDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.muted}
                  style={styles.inputInline}
                  value={examDate}
                />
                <Feather color={colors.mutedStrong} name="calendar" size={15} />
              </View>
            </View>
            <View style={styles.twoUpItem}>
              <Text style={styles.label}>START TIME</Text>
              <View style={styles.inputWithIcon}>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={setStartTime}
                  placeholder="HH:MM"
                  placeholderTextColor={colors.muted}
                  style={styles.inputInline}
                  value={startTime}
                />
                <Feather color={colors.mutedStrong} name="clock" size={15} />
              </View>
            </View>
          </View>

          <View style={styles.twoUp}>
            <View style={styles.twoUpItem}>
              <Text style={styles.label}>DURATION (HRS)</Text>
              <View style={styles.inputWithIcon}>
                <TextInput
                  keyboardType="decimal-pad"
                  onChangeText={setDurationHours}
                  placeholder="3"
                  placeholderTextColor={colors.muted}
                  style={styles.inputInline}
                  value={durationHours}
                />
                <Feather color={colors.mutedStrong} name="clock" size={15} />
              </View>
            </View>
            <View style={styles.twoUpItem}>
              <Text style={styles.label}>MAX STUDENTS</Text>
              <TextInput
                keyboardType="number-pad"
                onChangeText={setMaxStudents}
                placeholder="50"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={maxStudents}
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>REGISTER STUDENT IDS (OPTIONAL)</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              multiline
              numberOfLines={3}
              onChangeText={setStudentIdsInput}
              placeholder="12345678, 12345679"
              placeholderTextColor={colors.muted}
              style={[styles.input, styles.multilineInput]}
              textAlignVertical="top"
              value={studentIdsInput}
            />
            <Text style={styles.helperText}>
              Leave empty to register all students, or separate specific IDs with commas/spaces.
            </Text>
          </View>
        </SurfaceCard>

        <View style={styles.questionSection}>
          <View style={styles.questionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Questions</Text>
              <Text style={styles.sectionMeta}>Optional multiple-choice auto-grading</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={addQuestion}
              style={({ pressed }) => [styles.addQuestionButton, pressed ? styles.buttonPressed : null]}>
              <Feather color={colors.warning} name="plus" size={13} />
              <Text style={styles.addQuestionText}>Add</Text>
            </Pressable>
          </View>

          <View style={styles.questionList}>
            {questions.map((question, questionIndex) => (
              <SurfaceCard key={`question-${questionIndex}`} style={styles.questionCard}>
                <View style={styles.questionCardHeader}>
                  <Text style={styles.questionTitle}>Question {questionIndex + 1}</Text>
                  <Pressable
                    onPress={() => removeQuestion(questionIndex)}
                    style={styles.removeQuestionButton}>
                    <Feather color={colors.danger} name="trash-2" size={13} />
                  </Pressable>
                </View>

                <TextInput
                  autoCapitalize="sentences"
                  autoCorrect={false}
                  multiline
                  onChangeText={(prompt) => updateQuestionPrompt(questionIndex, prompt)}
                  placeholder="Enter question text"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, styles.questionPromptInput]}
                  textAlignVertical="top"
                  value={question.prompt}
                />

                <View style={styles.optionList}>
                  {question.options.map((option, optionIndex) => {
                    const optionLabel = String.fromCharCode(65 + optionIndex);
                    const isCorrect = question.correctOptionIndex === optionIndex;

                    return (
                      <View key={`${questionIndex}-${optionLabel}`} style={styles.optionRow}>
                        <Pressable
                          onPress={() => updateQuestionCorrectOption(questionIndex, optionIndex)}
                          style={[
                            styles.correctOptionButton,
                            isCorrect ? styles.correctOptionButtonActive : null,
                          ]}>
                          <Text
                            style={[
                              styles.correctOptionButtonText,
                              isCorrect ? styles.correctOptionButtonTextActive : null,
                            ]}>
                            {optionLabel}
                          </Text>
                        </Pressable>
                        <TextInput
                          autoCapitalize="sentences"
                          autoCorrect={false}
                          onChangeText={(value) =>
                            updateQuestionOption(questionIndex, optionIndex, value)
                          }
                          placeholder={`Option ${optionLabel}`}
                          placeholderTextColor={colors.muted}
                          style={[styles.input, styles.optionInput]}
                          value={option}
                        />
                      </View>
                    );
                  })}
                </View>
              </SurfaceCard>
            ))}
          </View>
        </View>

        <View style={styles.modeHeader}>
          <View>
            <Text style={styles.sectionTitle}>Monitoring mode</Text>
            <Text style={styles.sectionMeta}>Choose how strict this session should be</Text>
          </View>
          <Feather color={colors.warning} name="shield" size={18} />
        </View>
        <View style={styles.modeList}>
          {monitoringModes.map((item) => {
            const active = item.value === mode;

            return (
              <Pressable
                key={item.value}
                onPress={() => setMode(item.value)}
                style={[styles.modeCard, active ? styles.modeCardActive : null]}>
                <View style={[styles.modeIndicator, active ? styles.modeIndicatorActive : null]} />
                <View>
                  <Text style={styles.modeTitle}>{item.title}</Text>
                  <Text style={styles.modeDescription}>{item.description}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <SurfaceCard style={styles.featureCard} tone="muted">
          <Text style={styles.label}>AI FEATURES</Text>
          <View style={styles.featureList}>
            {aiFeatures.map((feature) => (
              <View key={feature} style={styles.featureRow}>
                <View style={styles.featureDot} />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>
        </SurfaceCard>

        {errorMessage ? (
          <InlineMessage description={errorMessage} style={styles.inlineMessage} tone="danger" />
        ) : null}

        <ActionButton
          containerStyle={styles.primaryButtonSpacing}
          disabled={isSaving}
          icon={isSaving ? <ActivityIndicator color={colors.background} size="small" /> : undefined}
          label={isSaving ? '' : 'Create Session'}
          onPress={handleCreateSession}
          tone="accent"
        />

        <Pressable disabled={isSaving} onPress={() => router.back()} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    addQuestionButton: {
      alignItems: 'center',
      backgroundColor: colors.warningSoft,
      borderColor: colors.warningSoft,
      borderRadius: radius.pill,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 6,
      minHeight: 38,
      paddingHorizontal: 12,
    },
    addQuestionText: {
      color: colors.warning,
      fontFamily: font.body,
      fontSize: type.body,
      fontWeight: '900',
    },
    buttonPressed: {
      opacity: 0.9,
      transform: [{ scale: 0.985 }],
    },
    content: {
      alignSelf: 'center',
      maxWidth: layout.maxWidth,
      paddingBottom: layout.bottomPadding,
      paddingHorizontal: layout.screenPaddingWide,
      paddingTop: 4,
      width: '100%',
    },
    eyebrow: {
      color: colors.warning,
      fontFamily: font.body,
      fontSize: type.label,
      fontWeight: '900',
      letterSpacing: 1.1,
    },
    eyebrowDot: {
      backgroundColor: colors.warning,
      borderRadius: radius.pill,
      height: 7,
      width: 7,
    },
    eyebrowPill: {
      alignItems: 'center',
      backgroundColor: colors.warningSoft,
      borderColor: colors.warningSoft,
      borderRadius: radius.pill,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 7,
      paddingHorizontal: 11,
      paddingVertical: 8,
    },
    correctOptionButton: {
      alignItems: 'center',
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      height: 42,
      justifyContent: 'center',
      marginTop: 10,
      width: 42,
    },
    correctOptionButtonActive: {
      backgroundColor: colors.successSoft,
      borderColor: colors.success,
    },
    correctOptionButtonText: {
      color: colors.mutedStrong,
      fontFamily: font.body,
      fontSize: type.bodyLarge,
      fontWeight: '900',
    },
    correctOptionButtonTextActive: {
      color: colors.success,
    },
    featureCard: {
      marginTop: 16,
    },
    featureDot: {
      backgroundColor: colors.success,
      borderRadius: 99,
      height: 5,
      marginTop: 6,
      width: 5,
    },
    featureList: {
      gap: 10,
      marginTop: 14,
    },
    featureRow: {
      flexDirection: 'row',
      gap: 8,
    },
    featureText: {
      color: colors.mutedStrong,
      fontFamily: font.body,
      fontSize: type.bodyLarge,
      lineHeight: 21,
    },
    formGroup: {
      marginTop: 16,
    },
    headerRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    helperText: {
      color: colors.muted,
      fontFamily: font.body,
      fontSize: type.tiny,
      lineHeight: 15,
      marginTop: 8,
    },
    heroBody: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 14,
      marginTop: 18,
    },
    heroCard: {
      backgroundColor: colors.panel,
      borderColor: colors.borderStrong,
      borderRadius: radius.lg,
      borderWidth: 1,
      paddingHorizontal: 16,
      paddingVertical: 16,
      ...shadow.raised,
    },
    heroIcon: {
      alignItems: 'center',
      backgroundColor: colors.warningSoft,
      borderColor: colors.warningSoft,
      borderRadius: radius.md,
      borderWidth: 1,
      height: 54,
      justifyContent: 'center',
      width: 54,
    },
    heroText: {
      flex: 1,
      minWidth: 0,
    },
    inlineMessage: {
      marginTop: 16,
    },
    input: {
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      color: colors.text,
      fontFamily: font.body,
      fontSize: type.bodyLarge,
      marginTop: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    inputInline: {
      color: colors.text,
      flex: 1,
      fontFamily: font.body,
      fontSize: type.bodyLarge,
      paddingVertical: 12,
    },
    inputWithIcon: {
      alignItems: 'center',
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 10,
      marginTop: 10,
      paddingHorizontal: 14,
    },
    label: {
      color: colors.mutedStrong,
      fontFamily: font.body,
      fontSize: type.label,
      fontWeight: '900',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    modeCard: {
      alignItems: 'flex-start',
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
      ...shadow.card,
    },
    modeCardActive: {
      backgroundColor: colors.warningSoft,
      borderColor: colors.warning,
    },
    modeDescription: {
      color: colors.mutedStrong,
      fontFamily: font.body,
      fontSize: type.body,
      lineHeight: 19,
      marginTop: 6,
    },
    modeIndicator: {
      borderColor: colors.border,
      borderRadius: radius.pill,
      borderWidth: 1,
      height: 14,
      marginTop: 3,
      width: 14,
    },
    modeIndicatorActive: {
      backgroundColor: colors.warning,
      borderColor: colors.warning,
    },
    modeHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 18,
    },
    modeList: {
      gap: 8,
      marginTop: 10,
    },
    modeTitle: {
      color: colors.text,
      fontFamily: font.body,
      fontSize: type.bodyLarge + 1,
      fontWeight: '900',
    },
    multilineInput: {
      minHeight: 88,
      paddingTop: 12,
    },
    optionInput: {
      flex: 1,
      marginTop: 10,
    },
    optionList: {
      gap: 6,
      marginTop: 6,
    },
    optionRow: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 8,
    },
    primaryButtonSpacing: {
      marginTop: 18,
    },
    safeArea: {
      backgroundColor: colors.background,
      flex: 1,
    },
    questionCard: {
      marginTop: 10,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    questionCardHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    questionHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    questionList: {
      marginTop: 4,
    },
    questionPromptInput: {
      minHeight: 78,
      paddingTop: 12,
    },
    questionTitle: {
      color: colors.text,
      fontFamily: font.body,
      fontSize: type.bodyLarge,
      fontWeight: '900',
    },
    questionSection: {
      marginTop: 18,
    },
    removeQuestionButton: {
      alignItems: 'center',
      borderColor: colors.dangerSoft,
      borderRadius: radius.sm,
      borderWidth: 1,
      height: 28,
      justifyContent: 'center',
      width: 28,
    },
    secondaryButton: {
      alignItems: 'center',
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      marginTop: 10,
      paddingVertical: 14,
    },
    secondaryButtonText: {
      color: colors.mutedStrong,
      fontFamily: font.body,
      fontSize: type.bodyLarge,
      fontWeight: '800',
    },
    sectionCard: {
      marginTop: 16,
      paddingVertical: 16,
    },
    sectionHeading: {
      alignItems: 'center',
      borderBottomColor: colors.borderSoft,
      borderBottomWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 2,
      paddingBottom: 14,
    },
    sectionMeta: {
      color: colors.muted,
      fontFamily: font.body,
      fontSize: 12,
      marginTop: 3,
    },
    sectionTitle: {
      color: colors.text,
      fontFamily: font.display,
      fontSize: type.bodyLarge,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    subtitle: {
      color: colors.mutedStrong,
      fontFamily: font.body,
      fontSize: type.body,
      lineHeight: 20,
      marginTop: 6,
    },
    title: {
      color: colors.text,
      fontFamily: font.display,
      fontSize: type.display,
      fontWeight: '900',
      lineHeight: type.display + 5,
    },
    twoUp: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 18,
    },
    twoUpItem: {
      flex: 1,
    },
  });
}
