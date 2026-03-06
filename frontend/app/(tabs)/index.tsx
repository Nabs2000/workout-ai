import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Button, Card, ActivityIndicator, Chip } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useUserStore } from '../../stores/userStore';
import { api } from '../../services/api';
import { COLORS, DAY_NAMES, GOAL_LABELS, MUSCLE_EMOJI } from '../../constants';
import { getCurrentWeek } from '../../services/dateUtils';

export default function HomeScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { userId, profile } = useUserStore();
  const { week, year } = getCurrentWeek();

  const planQuery = useQuery({
    queryKey: ['plan', 'current', userId],
    queryFn: () => api.plan.getCurrent(userId!),
    enabled: !!userId,
  });

  const analysisQuery = useQuery({
    queryKey: ['analysis', 'latest', userId],
    queryFn: () => api.analyze.getLatest(userId!),
    enabled: !!userId,
  });

  const generateMutation = useMutation({
    mutationFn: () => api.plan.generate(userId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plan'] }),
  });

  const analyzeMutation = useMutation({
    mutationFn: () => api.analyze.runWeekly(userId!, week, year),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['analysis'] });
      qc.invalidateQueries({ queryKey: ['plan'] });
    },
  });

  const todayDow = (new Date().getDay() + 6) % 7; // 0=Mon
  const todayWorkout = planQuery.data?.workouts.find((w) => w.dayOfWeek === todayDow);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text variant="bodySmall" style={styles.label}>Good {getGreeting()}</Text>
          <Text variant="headlineMedium" style={styles.name}>{profile?.name ?? 'Athlete'} 👋</Text>
        </View>
        <Chip style={styles.goalChip} textStyle={{ color: COLORS.primary }}>
          {GOAL_LABELS[profile?.goal ?? 'build_muscle']}
        </Chip>
      </View>

      {/* Today's workout */}
      <Text variant="titleMedium" style={styles.sectionTitle}>Today's Workout</Text>
      {planQuery.isLoading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 16 }} />
      ) : !planQuery.data ? (
        <Card style={styles.emptyCard}>
          <Card.Content style={styles.emptyContent}>
            <Text style={styles.emptyEmoji}>🤖</Text>
            <Text variant="titleMedium" style={styles.emptyTitle}>No plan yet</Text>
            <Text variant="bodyMedium" style={styles.emptySubtitle}>
              Let Amazon Nova build your personalized training plan.
            </Text>
            <Button
              mode="contained"
              onPress={() => generateMutation.mutate()}
              loading={generateMutation.isPending}
              style={{ marginTop: 16 }}
            >
              Generate My Plan
            </Button>
          </Card.Content>
        </Card>
      ) : todayWorkout ? (
        <Card style={styles.workoutCard} onPress={() => router.push('/(tabs)/plan')}>
          <Card.Content>
            <View style={styles.workoutHeader}>
              <Text variant="titleLarge" style={styles.workoutName}>{todayWorkout.name}</Text>
              <Text style={styles.workoutDuration}>⏱ {todayWorkout.estimatedMinutes} min</Text>
            </View>
            <View style={styles.exerciseList}>
              {todayWorkout.exercises.slice(0, 4).map((ex, i) => (
                <View key={i} style={styles.exerciseRow}>
                  <Text style={styles.exerciseEmoji}>{MUSCLE_EMOJI[ex.muscleGroup]}</Text>
                  <Text style={styles.exerciseName}>{ex.name}</Text>
                  <Text style={styles.exerciseSets}>{ex.sets}×{ex.reps}</Text>
                </View>
              ))}
              {todayWorkout.exercises.length > 4 && (
                <Text style={styles.moreText}>+{todayWorkout.exercises.length - 4} more</Text>
              )}
            </View>
            <Button
              mode="contained"
              onPress={() => router.push('/(tabs)/log')}
              style={{ marginTop: 12 }}
            >
              Start Workout
            </Button>
          </Card.Content>
        </Card>
      ) : (
        <Card style={styles.restCard}>
          <Card.Content style={styles.emptyContent}>
            <Text style={styles.emptyEmoji}>😴</Text>
            <Text variant="titleMedium" style={styles.emptyTitle}>Rest Day</Text>
            <Text variant="bodyMedium" style={styles.emptySubtitle}>
              Recovery is part of the plan. See you tomorrow!
            </Text>
          </Card.Content>
        </Card>
      )}

      {/* Weekly snapshot */}
      {planQuery.data && (
        <>
          <Text variant="titleMedium" style={styles.sectionTitle}>This Week</Text>
          <Card style={styles.weekCard}>
            <Card.Content>
              <View style={styles.daysRow}>
                {DAY_NAMES.map((day, i) => {
                  const hasWorkout = planQuery.data!.workouts.some((w) => w.dayOfWeek === i);
                  const isToday = i === todayDow;
                  return (
                    <View key={day} style={[styles.dayDot, isToday && styles.dayDotToday]}>
                      <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>{day}</Text>
                      <View style={[
                        styles.dot,
                        hasWorkout ? styles.dotActive : styles.dotRest,
                        isToday && styles.dotToday,
                      ]} />
                    </View>
                  );
                })}
              </View>
            </Card.Content>
          </Card>
        </>
      )}

      {/* AI Insight */}
      {analysisQuery.data && (
        <>
          <Text variant="titleMedium" style={styles.sectionTitle}>AI Insight</Text>
          <Card style={styles.insightCard}>
            <Card.Content>
              <View style={styles.insightHeader}>
                <Text style={styles.insightBadge}>🤖 Nova Analysis</Text>
                <Text style={styles.adherence}>
                  {analysisQuery.data.adherencePercent}% adherence
                </Text>
              </View>
              <Text style={styles.insightSummary}>{analysisQuery.data.summary}</Text>
              {analysisQuery.data.planAdjusted && (
                <Chip
                  style={styles.adjustedChip}
                  textStyle={{ color: COLORS.success }}
                >
                  Plan adjusted for next week
                </Chip>
              )}
            </Card.Content>
          </Card>
        </>
      )}

      {/* Run analysis button */}
      {planQuery.data && (
        <Button
          mode="outlined"
          onPress={() => analyzeMutation.mutate()}
          loading={analyzeMutation.isPending}
          disabled={analyzeMutation.isPending}
          style={styles.analyzeBtn}
          icon="robot"
        >
          Analyze This Week
        </Button>
      )}
    </ScrollView>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 20, paddingTop: 60, paddingBottom: 32 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 28,
  },
  label: { color: COLORS.textMuted },
  name: { color: COLORS.text, fontWeight: 'bold' },
  goalChip: { backgroundColor: `${COLORS.primary}20` },
  sectionTitle: { color: COLORS.textSecondary, marginTop: 24, marginBottom: 12 },
  emptyCard: { backgroundColor: COLORS.bgCard, borderRadius: 16 },
  emptyContent: { alignItems: 'center', padding: 24 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { color: COLORS.text, fontWeight: 'bold', textAlign: 'center' },
  emptySubtitle: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 8 },
  workoutCard: { backgroundColor: COLORS.bgCard, borderRadius: 16 },
  workoutHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  workoutName: { color: COLORS.text, fontWeight: 'bold', flex: 1 },
  workoutDuration: { color: COLORS.textSecondary, fontSize: 14 },
  exerciseList: { gap: 8 },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exerciseEmoji: { fontSize: 18 },
  exerciseName: { color: COLORS.text, flex: 1, fontSize: 15 },
  exerciseSets: { color: COLORS.textSecondary, fontSize: 13 },
  moreText: { color: COLORS.textMuted, fontSize: 13, marginTop: 4 },
  restCard: { backgroundColor: COLORS.bgCard, borderRadius: 16 },
  weekCard: { backgroundColor: COLORS.bgCard, borderRadius: 16 },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayDot: { alignItems: 'center', gap: 6 },
  dayDotToday: {},
  dayLabel: { color: COLORS.textMuted, fontSize: 12 },
  dayLabelToday: { color: COLORS.primary, fontWeight: 'bold' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotActive: { backgroundColor: COLORS.primary },
  dotRest: { backgroundColor: COLORS.bgElevated },
  dotToday: { width: 12, height: 12, borderRadius: 6 },
  insightCard: { backgroundColor: `${COLORS.primary}15`, borderRadius: 16, borderWidth: 1, borderColor: `${COLORS.primary}40` },
  insightHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  insightBadge: { color: COLORS.primary, fontWeight: 'bold', fontSize: 13 },
  adherence: { color: COLORS.success, fontWeight: 'bold' },
  insightSummary: { color: COLORS.text, lineHeight: 22 },
  adjustedChip: { marginTop: 12, backgroundColor: `${COLORS.success}20`, alignSelf: 'flex-start' },
  analyzeBtn: { marginTop: 20, borderColor: COLORS.primary },
});
