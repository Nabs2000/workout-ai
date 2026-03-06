import { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Card, Button, TextInput, Chip, Snackbar, Divider } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';
import { useUserStore } from '../../stores/userStore';
import { api } from '../../services/api';
import { COLORS, MUSCLE_EMOJI } from '../../constants';
import { getCurrentWeek, toISODate } from '../../services/dateUtils';
import type { LoggedExercise, LoggedSet, Exercise } from '../../types';

export default function LogScreen() {
  const qc = useQueryClient();
  const { userId } = useUserStore();
  const { week, year } = getCurrentWeek();
  const todayDow = (new Date().getDay() + 6) % 7;

  const { data: plan } = useQuery({
    queryKey: ['plan', 'current', userId],
    queryFn: () => api.plan.getCurrent(userId!),
    enabled: !!userId,
  });

  const todayWorkout = plan?.workouts.find((w) => w.dayOfWeek === todayDow);

  const [exercises, setExercises] = useState<LoggedExercise[]>([]);
  const [difficulty, setDifficulty] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [notes, setNotes] = useState('');
  const [snack, setSnack] = useState('');
  const [initialized, setInitialized] = useState(false);

  // Pre-populate from today's plan on first render
  if (todayWorkout && !initialized && exercises.length === 0) {
    setInitialized(true);
    setExercises(
      todayWorkout.exercises.map((ex) => ({
        name: ex.name,
        muscleGroup: ex.muscleGroup,
        sets: Array.from({ length: ex.sets }, () => ({ reps: typeof ex.reps === 'number' ? ex.reps : 0 })),
      })),
    );
  }

  const logMutation = useMutation({
    mutationFn: () => {
      const start = Date.now();
      return api.log.create({
        userId: userId!,
        planId: plan?.planId,
        dayOfWeek: todayDow,
        date: toISODate(),
        weekNumber: week,
        year,
        exercises,
        durationMinutes: Math.round((Date.now() - start) / 60000) || 45,
        perceivedDifficulty: difficulty,
        notes: notes.trim() || undefined,
      });
    },
    onSuccess: () => {
      setSnack('Workout logged! Great work 💪');
      qc.invalidateQueries({ queryKey: ['logs'] });
      qc.invalidateQueries({ queryKey: ['progress'] });
    },
    onError: (e: any) => setSnack(e.message ?? 'Failed to save workout'),
  });

  function updateSet(exIdx: number, setIdx: number, field: keyof LoggedSet, value: string) {
    const num = parseInt(value, 10);
    if (isNaN(num) && value !== '') return;
    setExercises((prev) => {
      const next = prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        const sets = ex.sets.map((s, j) =>
          j === setIdx ? { ...s, [field]: value === '' ? 0 : num } : s,
        );
        return { ...ex, sets };
      });
      return next;
    });
  }

  function addSet(exIdx: number) {
    setExercises((prev) =>
      prev.map((ex, i) =>
        i === exIdx ? { ...ex, sets: [...ex.sets, { reps: 0 }] } : ex,
      ),
    );
  }

  function removeSet(exIdx: number, setIdx: number) {
    setExercises((prev) =>
      prev.map((ex, i) =>
        i === exIdx ? { ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) } : ex,
      ),
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="headlineMedium" style={styles.title}>Log Workout</Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        {todayWorkout ? todayWorkout.name : 'Custom workout'}
      </Text>

      {exercises.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Card.Content style={styles.emptyContent}>
            <Text style={styles.emptyEmoji}>✏️</Text>
            <Text style={styles.emptyTitle}>No exercises yet</Text>
            <Text style={styles.emptySubtitle}>
              {todayWorkout
                ? 'Your plan will be loaded automatically.'
                : 'Go to Plan tab to generate a workout plan.'}
            </Text>
          </Card.Content>
        </Card>
      ) : (
        exercises.map((ex, exIdx) => (
          <ExerciseLogger
            key={exIdx}
            exercise={ex}
            onUpdateSet={(si, f, v) => updateSet(exIdx, si, f, v)}
            onAddSet={() => addSet(exIdx)}
            onRemoveSet={(si) => removeSet(exIdx, si)}
          />
        ))
      )}

      {exercises.length > 0 && (
        <>
          {/* Difficulty */}
          <Text variant="titleMedium" style={styles.sectionTitle}>How hard was it?</Text>
          <View style={styles.diffRow}>
            {([1, 2, 3, 4, 5] as const).map((n) => (
              <Chip
                key={n}
                selected={difficulty === n}
                onPress={() => setDifficulty(n)}
                style={[styles.diffChip, difficulty === n && styles.diffChipSelected]}
                textStyle={{ color: difficulty === n ? COLORS.text : COLORS.textMuted }}
              >
                {DIFFICULTY_LABELS[n]}
              </Chip>
            ))}
          </View>

          {/* Notes */}
          <TextInput
            mode="outlined"
            label="Notes (optional)"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            style={styles.notesInput}
            placeholder="How did it feel? Any PRs?"
          />

          <Button
            mode="contained"
            onPress={() => logMutation.mutate()}
            loading={logMutation.isPending}
            disabled={logMutation.isPending}
            style={styles.saveBtn}
            contentStyle={styles.saveBtnContent}
            icon="check"
          >
            Save Workout
          </Button>
        </>
      )}

      <Snackbar visible={!!snack} onDismiss={() => setSnack('')} duration={3000}>
        {snack}
      </Snackbar>
    </ScrollView>
  );
}

function ExerciseLogger({
  exercise, onUpdateSet, onAddSet, onRemoveSet,
}: {
  exercise: LoggedExercise;
  onUpdateSet: (setIdx: number, field: keyof LoggedSet, value: string) => void;
  onAddSet: () => void;
  onRemoveSet: (setIdx: number) => void;
}) {
  return (
    <Card style={styles.exerciseCard}>
      <Card.Content>
        <View style={styles.exerciseHeader}>
          <Text style={styles.exerciseEmoji}>{MUSCLE_EMOJI[exercise.muscleGroup]}</Text>
          <Text variant="titleMedium" style={styles.exerciseName}>{exercise.name}</Text>
        </View>
        <Divider style={styles.divider} />
        <View style={styles.setHeaderRow}>
          <Text style={[styles.setCol, styles.setHeaderText]}>Set</Text>
          <Text style={[styles.setColWide, styles.setHeaderText]}>Reps</Text>
          <Text style={[styles.setColWide, styles.setHeaderText]}>Weight (kg)</Text>
          <View style={{ width: 32 }} />
        </View>
        {exercise.sets.map((set, si) => (
          <View key={si} style={styles.setRow}>
            <Text style={[styles.setCol, styles.setNum]}>{si + 1}</Text>
            <TextInput
              mode="outlined"
              value={set.reps === 0 ? '' : String(set.reps)}
              onChangeText={(v) => onUpdateSet(si, 'reps', v)}
              keyboardType="numeric"
              style={styles.setInput}
              dense
              placeholder="0"
            />
            <TextInput
              mode="outlined"
              value={set.weight ? String(set.weight) : ''}
              onChangeText={(v) => onUpdateSet(si, 'weight', v)}
              keyboardType="numeric"
              style={styles.setInput}
              dense
              placeholder="BW"
            />
            <Button
              compact
              onPress={() => onRemoveSet(si)}
              style={styles.removeBtn}
              textColor={COLORS.danger}
            >
              ✕
            </Button>
          </View>
        ))}
        <Button
          mode="text"
          onPress={onAddSet}
          icon="plus"
          textColor={COLORS.primary}
          style={{ marginTop: 8 }}
        >
          Add Set
        </Button>
      </Card.Content>
    </Card>
  );
}

const DIFFICULTY_LABELS: Record<number, string> = {
  1: '😴 Easy',
  2: '🙂 Light',
  3: '💪 Medium',
  4: '😤 Hard',
  5: '🔥 Max',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 20, paddingTop: 60, paddingBottom: 32, gap: 16 },
  title: { color: COLORS.text, fontWeight: 'bold' },
  subtitle: { color: COLORS.textSecondary, marginTop: -8 },
  sectionTitle: { color: COLORS.textSecondary, marginTop: 8 },
  emptyCard: { backgroundColor: COLORS.bgCard, borderRadius: 16 },
  emptyContent: { alignItems: 'center', padding: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { color: COLORS.text, fontWeight: 'bold', fontSize: 18 },
  emptySubtitle: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 8 },
  exerciseCard: { backgroundColor: COLORS.bgCard, borderRadius: 16 },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  exerciseEmoji: { fontSize: 22 },
  exerciseName: { color: COLORS.text, fontWeight: 'bold', flex: 1 },
  divider: { backgroundColor: COLORS.border, marginVertical: 12 },
  setHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  setHeaderText: { color: COLORS.textMuted, fontSize: 12 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  setCol: { width: 30, textAlign: 'center' },
  setColWide: { flex: 1 },
  setNum: { color: COLORS.textMuted, fontSize: 14 },
  setInput: { flex: 1, backgroundColor: COLORS.bgElevated, height: 40 },
  removeBtn: { minWidth: 0, paddingHorizontal: 4 },
  diffRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  diffChip: { backgroundColor: COLORS.bgCard },
  diffChipSelected: { backgroundColor: COLORS.primary },
  notesInput: { backgroundColor: COLORS.bgCard },
  saveBtn: { borderRadius: 14, marginTop: 8 },
  saveBtnContent: { paddingVertical: 6 },
});
