import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { layout, palette, type } from '@/constants/design';
import {
  fetchStudentExamSessionData,
  submitStudentExamAnswers,
  type StudentExamSessionData,
} from '@/lib/student-exam';

const EMPTY_QUESTIONS: StudentExamSessionData['questions'] = [];

function formatCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function deriveRemainingSeconds(scheduledEndIso: string) {
  const endTimestamp = new Date(scheduledEndIso).getTime();
  if (Number.isNaN(endTimestamp)) {
    return 0;
  }

  return Math.max(0, Math.floor((endTimestamp - Date.now()) / 1000));
}

export default function ExamSessionScreen() {
  const params = useLocalSearchParams<{ examId?: string }>();
  const examId = typeof params.examId === 'string' ? params.examId : '';

  const [sessionData, setSessionData] = useState<StudentExamSessionData | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadExamSession = async () => {
      setIsLoading(true);
      setErrorMessage('');

      try {
        if (!examId) {
          throw new Error('No exam was selected.');
        }

        const result = await fetchStudentExamSessionData(examId);
        if (!isMounted) {
          return;
        }

        if (result.hasSubmitted) {
          router.replace({
            pathname: '/(tabs)/results',
            params: { examId: result.examId },
          });
          return;
        }

        setSessionData(result);
        setSelectedOptions({});
        setQuestionIndex(0);
        setRemainingSeconds(deriveRemainingSeconds(result.scheduledEnd));
      } catch (error) {
        if (isMounted) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Unable to load this exam session.'
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadExamSession();

    return () => {
      isMounted = false;
    };
  }, [examId]);

  useEffect(() => {
    if (!sessionData) {
      return undefined;
    }

    const timer = setInterval(() => {
      setRemainingSeconds(deriveRemainingSeconds(sessionData.scheduledEnd));
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [sessionData]);

  const questions = sessionData?.questions ?? EMPTY_QUESTIONS;
  const totalQuestions = questions.length;
  const answeredCount = useMemo(
    () =>
      questions.filter((question) => {
        const selectedOptionId = selectedOptions[question.id];
        return Boolean(selectedOptionId);
      }).length,
    [questions, selectedOptions]
  );
  const currentQuestion = questions[questionIndex] ?? null;
  const progressPercent =
    totalQuestions > 0 ? Math.round(((questionIndex + 1) / totalQuestions) * 100) : 0;

  const selectOption = (questionId: string, optionId: string) => {
    setSelectedOptions((current) => ({
      ...current,
      [questionId]: optionId,
    }));
  };

  const handleSubmit = async () => {
    if (!sessionData) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await submitStudentExamAnswers({
        answers: sessionData.questions.map((question) => ({
          questionId: question.id,
          selectedOptionId: selectedOptions[question.id] ?? null,
        })),
        examIdInput: sessionData.examId,
      });

      setShowConfirm(false);
      router.replace({
        pathname: '/(tabs)/results',
        params: { examId: sessionData.examId },
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to submit exam answers.');
      setShowConfirm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Feather color={palette.mutedStrong} name="chevron-left" size={18} />
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerCode}>{sessionData?.courseCode ?? 'COURSE'}</Text>
            <Text style={styles.headerTitle}>{sessionData?.examTitle ?? 'Exam Session'}</Text>
          </View>
          <View style={styles.timerBox}>
            <Text style={styles.timerText}>{formatCountdown(remainingSeconds)}</Text>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={palette.teal} size="small" />
            <Text style={styles.loadingText}>Loading exam questions...</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <Pressable onPress={() => router.replace('/(tabs)')} style={styles.errorAction}>
              <Text style={styles.errorActionText}>Back to dashboard</Text>
            </Pressable>
          </View>
        ) : null}

        {!isLoading && !errorMessage && currentQuestion ? (
          <>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>
                Q{questionIndex + 1} / {totalQuestions}
              </Text>
              <Text style={styles.progressLabel}>{progressPercent}%</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
            </View>

            <Text style={styles.question}>{currentQuestion.prompt}</Text>

            <View style={styles.optionsList}>
              {currentQuestion.options.map((option) => {
                const active = selectedOptions[currentQuestion.id] === option.id;

                return (
                  <Pressable
                    key={option.id}
                    onPress={() => selectOption(currentQuestion.id, option.id)}
                    style={[styles.optionCard, active ? styles.optionCardActive : null]}>
                    <View style={[styles.choiceBox, active ? styles.choiceBoxActive : null]} />
                    <Text style={styles.optionKey}>{option.label}.</Text>
                    <Text style={styles.optionText}>{option.text}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.navigationRow}>
              <Pressable
                disabled={questionIndex === 0}
                onPress={() => setQuestionIndex((index) => Math.max(0, index - 1))}
                style={[
                  styles.navigationButton,
                  questionIndex === 0 ? styles.navigationButtonDisabled : null,
                ]}>
                <Text style={styles.navigationButtonText}>Previous</Text>
              </Pressable>

              {questionIndex < totalQuestions - 1 ? (
                <Pressable
                  onPress={() => setQuestionIndex((index) => Math.min(totalQuestions - 1, index + 1))}
                  style={styles.navigationButton}>
                  <Text style={styles.navigationButtonText}>Next</Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => setShowConfirm(true)} style={styles.submitButton}>
                  <Text style={styles.submitText}>Submit Exam</Text>
                </Pressable>
              )}
            </View>

            <Text style={styles.answerCounter}>
              {answeredCount} of {totalQuestions} questions answered
            </Text>
          </>
        ) : null}
      </ScrollView>

      <Modal animationType="fade" onRequestClose={() => setShowConfirm(false)} transparent visible={showConfirm}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalEyebrow}>CONFIRM SUBMISSION</Text>
            <Text style={styles.modalTitle}>Submit exam?</Text>
            <Text style={styles.modalCopy}>
              You have answered <Text style={styles.modalCopyStrong}>{answeredCount}</Text> of{' '}
              <Text style={styles.modalCopyStrong}>{totalQuestions}</Text> questions.
            </Text>

            <Pressable
              disabled={isSubmitting}
              onPress={() => void handleSubmit()}
              style={[styles.modalPrimaryButton, isSubmitting ? styles.primaryButtonDisabled : null]}>
              {isSubmitting ? (
                <ActivityIndicator color={palette.text} size="small" />
              ) : (
                <Text style={styles.modalPrimaryText}>Yes, submit</Text>
              )}
            </Pressable>

            <Pressable disabled={isSubmitting} onPress={() => setShowConfirm(false)} style={styles.modalSecondaryButton}>
              <Text style={styles.modalSecondaryText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  answerCounter: {
    color: palette.mutedStrong,
    fontSize: type.body,
    marginTop: 14,
    textAlign: 'center',
  },
  backButton: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  choiceBox: {
    borderColor: palette.border,
    borderWidth: 1,
    height: 18,
    marginTop: 2,
    width: 18,
  },
  choiceBoxActive: {
    backgroundColor: palette.teal,
    borderColor: palette.teal,
  },
  content: {
    alignSelf: 'center',
    maxWidth: layout.maxWidth,
    paddingBottom: layout.bottomPadding,
    paddingHorizontal: layout.screenPaddingWide,
    width: '100%',
  },
  errorAction: {
    borderColor: '#b34954',
    borderWidth: 1,
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  errorActionText: {
    color: '#ff9ea8',
    fontSize: type.body,
    fontWeight: '700',
  },
  errorCard: {
    alignItems: 'flex-start',
    backgroundColor: '#2f1116',
    borderColor: '#8f2d37',
    borderWidth: 1,
    marginBottom: 14,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  errorText: {
    color: '#ff9ea8',
    fontSize: type.body,
  },
  headerCode: {
    color: palette.mutedStrong,
    fontSize: type.tiny,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerTitle: {
    color: palette.text,
    fontSize: type.bodyLarge,
    fontWeight: '700',
    marginTop: 4,
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  loadingCard: {
    alignItems: 'center',
    backgroundColor: palette.panel,
    borderColor: palette.border,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  loadingText: {
    color: palette.mutedStrong,
    fontSize: type.body,
  },
  modalCard: {
    backgroundColor: palette.panel,
    borderColor: palette.border,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
    width: '82%',
  },
  modalCopy: {
    color: palette.mutedStrong,
    fontSize: type.bodyLarge,
    lineHeight: 22,
    marginTop: 12,
  },
  modalCopyStrong: {
    color: palette.text,
    fontWeight: '800',
  },
  modalEyebrow: {
    color: '#ff5a61',
    fontSize: type.label,
    letterSpacing: 2,
  },
  modalOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(2, 7, 18, 0.82)',
    flex: 1,
    justifyContent: 'center',
  },
  modalPrimaryButton: {
    alignItems: 'center',
    backgroundColor: '#f14545',
    marginTop: 20,
    paddingVertical: 14,
  },
  modalPrimaryText: {
    color: palette.text,
    fontSize: type.bodyLarge,
    fontWeight: '800',
  },
  modalSecondaryButton: {
    alignItems: 'center',
    borderColor: palette.border,
    borderWidth: 1,
    marginTop: 8,
    paddingVertical: 14,
  },
  modalSecondaryText: {
    color: palette.mutedStrong,
    fontSize: type.bodyLarge,
  },
  modalTitle: {
    color: palette.text,
    fontSize: type.display,
    fontWeight: '800',
    marginTop: 12,
  },
  navigationButton: {
    alignItems: 'center',
    borderColor: palette.border,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 14,
  },
  navigationButtonDisabled: {
    opacity: 0.5,
  },
  navigationButtonText: {
    color: palette.mutedStrong,
    fontSize: type.bodyLarge,
    fontWeight: '700',
  },
  navigationRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  optionCard: {
    backgroundColor: palette.panel,
    borderColor: palette.border,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 15,
  },
  optionCardActive: {
    borderColor: palette.teal,
  },
  optionKey: {
    color: '#5f7fb0',
    fontSize: type.bodyLarge,
    marginTop: 1,
  },
  optionText: {
    color: palette.text,
    flex: 1,
    fontSize: type.bodyLarge,
    lineHeight: 23,
  },
  optionsList: {
    gap: layout.cardGap,
    marginTop: 16,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  progressBar: {
    backgroundColor: '#213457',
    height: 2,
    marginTop: 8,
  },
  progressFill: {
    backgroundColor: palette.teal,
    height: 2,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  progressLabel: {
    color: '#7b97c5',
    fontSize: 11,
  },
  question: {
    color: palette.text,
    fontSize: type.title,
    fontWeight: '800',
    lineHeight: 26,
    marginTop: 18,
  },
  safeArea: {
    backgroundColor: palette.background,
    flex: 1,
  },
  submitButton: {
    alignItems: 'center',
    borderColor: '#0bba70',
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 15,
  },
  submitText: {
    color: '#1df886',
    fontSize: type.bodyLarge,
    fontWeight: '800',
    letterSpacing: 1.3,
  },
  timerBox: {
    alignItems: 'center',
    borderColor: palette.teal,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 32,
    minWidth: 72,
    paddingHorizontal: 8,
  },
  timerText: {
    color: palette.teal,
    fontSize: type.title,
    fontWeight: '800',
  },
});
