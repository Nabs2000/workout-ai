import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Card, Button, ActivityIndicator, Divider } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUserStore } from '../../stores/userStore';
import { api } from '../../services/api';
import { COLORS, DAY_NAMES_FULL, MUSCLE_EMOJI } from '../../constants';
import type { PlannedWorkout } from '../../types';

export default function PlanScreen() {
  const qc = useQueryClient();
  const { userId } = useUserStore();

  const { data: plan, isLoading } = useQuery({
    queryKey: ['plan', 'current', userId],
    queryFn: () => api.plan.getCurrent(userId!),
    enabled: !!userId,
  });

  const generateMutation = useMutation({
    mutationFn: () => api.plan.generate(userId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plan'] }),
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>Training Plan</Text>
        <Button
          mode="outlined"
          onPress={() => generateMutation.mutate()}
          loading={generateMutation.isPending}
          compact
          icon="refresh"
          style={styles.refreshBtn}
        >
          Regenerate
        </Button>
      </View>

      {plan?.aiNotes && (
        <Card style={styles.notesCard}>
          <Card.Content>
            <Text style={styles.notesLabel}>🤖 Coach Notes</Text>
            <Text style={styles.notesText}>{plan.aiNotes}</Text>
          </Card.Content>
        </Card>
      )}

      {isLoading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 32 }} size="large" />
      ) : !plan ? (
        <Card style={styles.emptyCard}>
          <Card.Content style={styles.emptyContent}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text variant="titleMedium" style={styles.emptyTitle}>No plan yet</Text>
            <Button
              mode="contained"
              onPress={() => generateMutation.mutate()}
              loading={generateMutation.isPending}
              style={{ marginTop: 16 }}
            >
              Generate Plan with Nova AI
            </Button>
          </Card.Content>
        </Card>
      ) : (
        <View style={styles.workoutList}>
          {plan.workouts
            .slice()
            .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
            .map((workout) => (
              <WorkoutDay key={workout.dayOfWeek} workout={workout} />
            ))}
        </View>
      )}
    </ScrollView>
  );
}

function WorkoutDay({ workout }: { workout: PlannedWorkout }) {
  const todayDow = (new Date().getDay() + 6) % 7;
  const isToday = workout.dayOfWeek === todayDow;

  return (
    <Card style={[styles.dayCard, isToday && styles.dayCardToday]}>
      <Card.Content>
        <View style={styles.dayHeader}>
          <View style={styles.dayLabelRow}>
            {isToday && <View style={styles.todayDot} />}
            <Text variant="titleMedium" style={[styles.dayName, isToday && styles.dayNameToday]}>
              {DAY_NAMES_FULL[workout.dayOfWeek]}
            </Text>
          </View>
          <Text style={styles.duration}>⏱ {workout.estimatedMinutes} min</Text>
        </View>
        <Text variant="bodyMedium" style={styles.workoutName}>{workout.name}</Text>
        <Divider style={styles.divider} />
        {workout.exercises.map((ex, i) => (
          <View key={i} style={styles.exerciseRow}>
            <Text style={styles.exerciseEmoji}>{MUSCLE_EMOJI[ex.muscleGroup]}</Text>
            <View style={styles.exerciseInfo}>
              <Text style={styles.exerciseName}>{ex.name}</Text>
              {ex.notes && <Text style={styles.exerciseNotes}>{ex.notes}</Text>}
            </View>
            <View style={styles.exerciseMeta}>
              <Text style={styles.exerciseSets}>{ex.sets} × {ex.reps}</Text>
              <Text style={styles.exerciseRest}>rest {ex.restSeconds}s</Text>
            </View>
          </View>
        ))}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 20, paddingTop: 60, paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { color: COLORS.text, fontWeight: 'bold' },
  refreshBtn: { borderColor: COLORS.border },
  notesCard: { backgroundColor: `${COLORS.primary}15`, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: `${COLORS.primary}40` },
  notesLabel: { color: COLORS.primary, fontWeight: 'bold', marginBottom: 8, fontSize: 13 },
  notesText: { color: COLORS.text, lineHeight: 22 },
  emptyCard: { backgroundColor: COLORS.bgCard, borderRadius: 16 },
  emptyContent: { alignItems: 'center', padding: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { color: COLORS.text, fontWeight: 'bold' },
  workoutList: { gap: 16 },
  dayCard: { backgroundColor: COLORS.bgCard, borderRadius: 16 },
  dayCardToday: { borderWidth: 1.5, borderColor: COLORS.primary },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  todayDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  dayName: { color: COLORS.textSecondary },
  dayNameToday: { color: COLORS.primary, fontWeight: 'bold' },
  duration: { color: COLORS.textMuted, fontSize: 13 },
  workoutName: { color: COLORS.text, fontWeight: '600', marginTop: 4, marginBottom: 4 },
  divider: { backgroundColor: COLORS.border, marginVertical: 12 },
  exerciseRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  exerciseEmoji: { fontSize: 20, marginTop: 2 },
  exerciseInfo: { flex: 1 },
  exerciseName: { color: COLORS.text, fontSize: 15 },
  exerciseNotes: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  exerciseMeta: { alignItems: 'flex-end' },
  exerciseSets: { color: COLORS.primary, fontWeight: 'bold', fontSize: 14 },
  exerciseRest: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
});
