import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
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

import { layout, palette, type } from '@/constants/design';
import {
  createExamSession,
  type CreateExamQuestionInput,
  type CreateExamSessionInput,
} from '@/lib/invigilator-sessions';

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
  const [successMessage, setSuccessMessage] = useState('');

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
    setSuccessMessage('');
    setIsSaving(true);

    try {
      const requestedStudentIds = parseStudentInstitutionalIds(studentIdsInput);
      const isAllStudentsSession = requestedStudentIds.length === 0;
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

      const registrationCopy = isAllStudentsSession
        ? result.registeredCount > 0
          ? `Exam is open to all students. ${result.registeredCount} student${result.registeredCount === 1 ? '' : 's'} registered automatically.`
          : 'Exam is open to all students, but no student profiles were found to register.'
        : result.registeredCount > 0
          ? `${result.registeredCount} selected student${result.registeredCount === 1 ? '' : 's'} registered.`
          : 'No selected students were registered.';
      const missingIdsCopy =
        result.missingStudentIds.length > 0
          ? ` Missing IDs not found: ${result.missingStudentIds.join(', ')}.`
          : '';

      setSuccessMessage(`Session created successfully. ${registrationCopy}${missingIdsCopy}`);
      setStudentIdsInput('');
      setQuestions([createEmptyQuestion()]);
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
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.navigate('/(invigilator-tabs)')}
            style={styles.backButton}>
            <Feather color={palette.mutedStrong} name="chevron-left" size={18} />
          </Pressable>
          <Text style={styles.eyebrow}>NEW SESSION</Text>
        </View>

        <Text style={styles.title}>Create Exam Session</Text>

        <View style={styles.formGroup}>
          <Text style={styles.label}>COURSE CODE</Text>
          <TextInput
            autoCapitalize="characters"
            autoCorrect={false}
            onChangeText={setCourseCode}
            placeholder="CS 450"
            placeholderTextColor={palette.muted}
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
            placeholderTextColor={palette.muted}
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
                placeholderTextColor={palette.muted}
                style={styles.inputInline}
                value={examDate}
              />
              <Feather color={palette.mutedStrong} name="calendar" size={15} />
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
                placeholderTextColor={palette.muted}
                style={styles.inputInline}
                value={startTime}
              />
              <Feather color={palette.mutedStrong} name="clock" size={15} />
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
                placeholderTextColor={palette.muted}
                style={styles.inputInline}
                value={durationHours}
              />
              <Feather color={palette.mutedStrong} name="clock" size={15} />
            </View>
          </View>
          <View style={styles.twoUpItem}>
            <Text style={styles.label}>MAX STUDENTS</Text>
            <TextInput
              keyboardType="number-pad"
              onChangeText={setMaxStudents}
              placeholder="50"
              placeholderTextColor={palette.muted}
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
            placeholderTextColor={palette.muted}
            style={[styles.input, styles.multilineInput]}
            textAlignVertical="top"
            value={studentIdsInput}
          />
          <Text style={styles.helperText}>
            Leave empty to register all students, or separate specific IDs with commas/spaces.
          </Text>
        </View>

        <View style={styles.formGroup}>
          <View style={styles.questionHeader}>
            <Text style={styles.label}>MULTIPLE CHOICE QUESTIONS (OPTIONAL)</Text>
            <Pressable onPress={addQuestion} style={styles.addQuestionButton}>
              <Feather color={palette.warning} name="plus" size={13} />
              <Text style={styles.addQuestionText}>Add</Text>
            </Pressable>
          </View>
          <Text style={styles.helperText}>
            Set the question text, options, and mark the correct answer for auto-grading.
          </Text>

          <View style={styles.questionList}>
            {questions.map((question, questionIndex) => (
              <View key={`question-${questionIndex}`} style={styles.questionCard}>
                <View style={styles.questionCardHeader}>
                  <Text style={styles.questionTitle}>Question {questionIndex + 1}</Text>
                  <Pressable
                    onPress={() => removeQuestion(questionIndex)}
                    style={styles.removeQuestionButton}>
                    <Feather color="#ff8f8f" name="trash-2" size={13} />
                  </Pressable>
                </View>

                <TextInput
                  autoCapitalize="sentences"
                  autoCorrect={false}
                  multiline
                  onChangeText={(prompt) => updateQuestionPrompt(questionIndex, prompt)}
                  placeholder="Enter question text"
                  placeholderTextColor={palette.muted}
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
                          placeholderTextColor={palette.muted}
                          style={[styles.input, styles.optionInput]}
                          value={option}
                        />
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        </View>

        <Text style={[styles.label, styles.modeLabel]}>MONITORING MODE</Text>
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

        <View style={styles.featureCard}>
          <Text style={styles.label}>AI FEATURES</Text>
          <View style={styles.featureList}>
            {aiFeatures.map((feature) => (
              <View key={feature} style={styles.featureRow}>
                <View style={styles.featureDot} />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>
        </View>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}

        <Pressable
          disabled={isSaving}
          onPress={handleCreateSession}
          style={[styles.primaryButton, isSaving ? styles.primaryButtonDisabled : null]}>
          {isSaving ? (
            <ActivityIndicator color="#1a1300" size="small" />
          ) : (
            <Text style={styles.primaryButtonText}>Create Session</Text>
          )}
        </Pressable>

        <Pressable disabled={isSaving} onPress={() => router.back()} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  addQuestionButton: {
    alignItems: 'center',
    borderColor: '#6c5211',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  addQuestionText: {
    color: palette.warning,
    fontSize: type.body,
    fontWeight: '700',
  },
  backButton: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  content: {
    alignSelf: 'center',
    maxWidth: layout.maxWidth,
    paddingBottom: layout.bottomPadding,
    paddingHorizontal: layout.screenPaddingWide,
    width: '100%',
  },
  eyebrow: {
    color: palette.mutedStrong,
    fontSize: type.label,
    letterSpacing: 2.2,
  },
  errorText: {
    color: '#ff8f8f',
    fontSize: type.body,
    marginTop: 12,
  },
  correctOptionButton: {
    alignItems: 'center',
    borderColor: palette.border,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    marginTop: 10,
    width: 42,
  },
  correctOptionButtonActive: {
    backgroundColor: '#106c51',
    borderColor: '#0bba70',
  },
  correctOptionButtonText: {
    color: palette.mutedStrong,
    fontSize: type.bodyLarge,
    fontWeight: '700',
  },
  correctOptionButtonTextActive: {
    color: palette.text,
  },
  featureCard: {
    backgroundColor: palette.panel,
    borderColor: palette.border,
    borderWidth: 1,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  featureDot: {
    backgroundColor: palette.success,
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
    color: '#7fd8ff',
    fontSize: type.bodyLarge,
  },
  formGroup: {
    marginTop: 18,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  helperText: {
    color: palette.muted,
    fontSize: type.tiny,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#050d18',
    borderColor: palette.border,
    borderWidth: 1,
    color: palette.text,
    fontSize: type.bodyLarge,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputInline: {
    color: palette.text,
    flex: 1,
    fontSize: type.bodyLarge,
    paddingVertical: 12,
  },
  inputWithIcon: {
    alignItems: 'center',
    backgroundColor: '#050d18',
    borderColor: palette.border,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    paddingHorizontal: 14,
  },
  label: {
    color: palette.mutedStrong,
    fontSize: type.label,
    letterSpacing: 2,
  },
  modeCard: {
    alignItems: 'flex-start',
    backgroundColor: palette.panel,
    borderColor: palette.border,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  modeCardActive: {
    backgroundColor: '#062126',
    borderColor: '#0d8b86',
  },
  modeDescription: {
    color: palette.mutedStrong,
    fontSize: type.body,
    marginTop: 6,
  },
  modeIndicator: {
    borderColor: palette.border,
    borderWidth: 1,
    height: 14,
    marginTop: 3,
    width: 14,
  },
  modeIndicatorActive: {
    backgroundColor: palette.teal,
    borderColor: palette.teal,
  },
  modeLabel: {
    marginTop: 18,
  },
  modeList: {
    gap: 8,
    marginTop: 10,
  },
  modeTitle: {
    color: palette.text,
    fontSize: type.bodyLarge + 1,
    fontWeight: '700',
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
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#d7a413',
    marginTop: 18,
    paddingVertical: 15,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#1a1300',
    fontSize: type.bodyLarge,
    fontWeight: '800',
  },
  safeArea: {
    backgroundColor: palette.background,
    flex: 1,
  },
  questionCard: {
    backgroundColor: palette.panel,
    borderColor: palette.border,
    borderWidth: 1,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
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
    marginTop: 8,
  },
  questionPromptInput: {
    minHeight: 78,
    paddingTop: 12,
  },
  questionTitle: {
    color: palette.text,
    fontSize: type.bodyLarge,
    fontWeight: '700',
  },
  removeQuestionButton: {
    alignItems: 'center',
    borderColor: '#8f2d37',
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: palette.border,
    borderWidth: 1,
    marginTop: 10,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: palette.mutedStrong,
    fontSize: type.bodyLarge,
  },
  successText: {
    color: palette.success,
    fontSize: type.body,
    marginTop: 12,
  },
  title: {
    color: palette.text,
    fontSize: type.title,
    fontWeight: '800',
    marginTop: 22,
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
