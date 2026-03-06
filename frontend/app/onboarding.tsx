import { useState } from 'react';
import {
  View, ScrollView, StyleSheet, Pressable,
} from 'react-native';
import { Text, Button, TextInput, Snackbar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { v4 as uuidv4 } from 'uuid';
import { useUserStore } from '../stores/userStore';
import { api } from '../services/api';
import { COLORS, GOAL_LABELS, LEVEL_LABELS, EQUIPMENT_LABELS } from '../constants';
import type { FitnessGoal, FitnessLevel, Equipment } from '../types';

type Step = 'welcome' | 'name' | 'goal' | 'level' | 'equipment' | 'frequency';

const STEPS: Step[] = ['welcome', 'name', 'goal', 'level', 'equipment', 'frequency'];

export default function OnboardingScreen() {
  const router = useRouter();
  const setProfile = useUserStore((s) => s.setProfile);

  const [step, setStep] = useState<Step>('welcome');
  const [name, setName] = useState('');
  const [goal, setGoal] = useState<FitnessGoal>('build_muscle');
  const [level, setLevel] = useState<FitnessLevel>('beginner');
  const [equipment, setEquipment] = useState<Equipment>('full_gym');
  const [frequency, setFrequency] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const stepIndex = STEPS.indexOf(step);
  const progress = (stepIndex / (STEPS.length - 1)) * 100;

  function next() {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  }

  function back() {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  }

  async function finish() {
    if (!name.trim()) { setError('Please enter your name'); return; }
    setLoading(true);
    try {
      const userId = uuidv4();
      const profile = await api.user.create({
        userId,
        name: name.trim(),
        goal,
        fitnessLevel: level,
        equipment,
        workoutsPerWeek: frequency,
      });
      await setProfile(profile);
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e.message ?? 'Failed to create profile. Check your API URL.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      {/* Progress bar */}
      {step !== 'welcome' && (
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {step === 'welcome' && <WelcomeStep onNext={next} />}
        {step === 'name' && (
          <NameStep name={name} onChange={setName} onNext={next} onBack={back} />
        )}
        {step === 'goal' && (
          <ChoiceStep
            title="What's your primary goal?"
            value={goal}
            options={Object.entries(GOAL_LABELS) as [FitnessGoal, string][]}
            onChange={(v) => setGoal(v as FitnessGoal)}
            onNext={next}
            onBack={back}
          />
        )}
        {step === 'level' && (
          <ChoiceStep
            title="What's your fitness level?"
            value={level}
            options={Object.entries(LEVEL_LABELS) as [FitnessLevel, string][]}
            onChange={(v) => setLevel(v as FitnessLevel)}
            onNext={next}
            onBack={back}
          />
        )}
        {step === 'equipment' && (
          <ChoiceStep
            title="What equipment do you have?"
            value={equipment}
            options={Object.entries(EQUIPMENT_LABELS) as [Equipment, string][]}
            onChange={(v) => setEquipment(v as Equipment)}
            onNext={next}
            onBack={back}
          />
        )}
        {step === 'frequency' && (
          <FrequencyStep
            value={frequency}
            onChange={setFrequency}
            onFinish={finish}
            onBack={back}
            loading={loading}
          />
        )}
      </ScrollView>

      <Snackbar
        visible={!!error}
        onDismiss={() => setError('')}
        duration={4000}
        action={{ label: 'OK', onPress: () => setError('') }}
      >
        {error}
      </Snackbar>
    </View>
  );
}

// ─── Step sub-components ─────────────────────────────────────────────────────

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.emoji}>🏋️</Text>
      <Text variant="displaySmall" style={styles.heading}>FitCoach AI</Text>
      <Text variant="bodyLarge" style={styles.subtitle}>
        Your personal AI fitness coach, powered by Amazon Nova. It creates your
        training plan, tracks your progress, and adapts weekly based on how you're
        actually performing.
      </Text>
      <Button mode="contained" onPress={onNext} style={styles.btn} contentStyle={styles.btnContent}>
        Get Started
      </Button>
    </View>
  );
}

function NameStep({
  name, onChange, onNext, onBack,
}: { name: string; onChange: (v: string) => void; onNext: () => void; onBack: () => void }) {
  return (
    <View style={styles.stepContent}>
      <Text variant="headlineMedium" style={styles.heading}>What's your name?</Text>
      <TextInput
        mode="outlined"
        label="Your name"
        value={name}
        onChangeText={onChange}
        style={styles.input}
        autoFocus
        onSubmitEditing={onNext}
      />
      <View style={styles.navRow}>
        <Button onPress={onBack} style={styles.btnSecondary}>Back</Button>
        <Button mode="contained" onPress={onNext} disabled={!name.trim()} style={styles.btn}>
          Continue
        </Button>
      </View>
    </View>
  );
}

function ChoiceStep<T extends string>({
  title, value, options, onChange, onNext, onBack,
}: {
  title: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <View style={styles.stepContent}>
      <Text variant="headlineMedium" style={styles.heading}>{title}</Text>
      {options.map(([key, label]) => (
        <Pressable
          key={key}
          style={[styles.choiceCard, value === key && styles.choiceCardSelected]}
          onPress={() => onChange(key)}
        >
          <Text style={[styles.choiceText, value === key && styles.choiceTextSelected]}>
            {label}
          </Text>
        </Pressable>
      ))}
      <View style={styles.navRow}>
        <Button onPress={onBack} style={styles.btnSecondary}>Back</Button>
        <Button mode="contained" onPress={onNext} style={styles.btn}>Continue</Button>
      </View>
    </View>
  );
}

function FrequencyStep({
  value, onChange, onFinish, onBack, loading,
}: {
  value: number;
  onChange: (v: number) => void;
  onFinish: () => void;
  onBack: () => void;
  loading: boolean;
}) {
  return (
    <View style={styles.stepContent}>
      <Text variant="headlineMedium" style={styles.heading}>
        How many days per week can you train?
      </Text>
      <View style={styles.freqRow}>
        {[2, 3, 4, 5, 6].map((n) => (
          <Pressable
            key={n}
            style={[styles.freqBtn, value === n && styles.freqBtnSelected]}
            onPress={() => onChange(n)}
          >
            <Text style={[styles.freqText, value === n && styles.freqTextSelected]}>{n}</Text>
          </Pressable>
        ))}
      </View>
      <Text variant="bodyMedium" style={styles.subtitle}>
        days / week
      </Text>
      <View style={styles.navRow}>
        <Button onPress={onBack} style={styles.btnSecondary}>Back</Button>
        <Button
          mode="contained"
          onPress={onFinish}
          loading={loading}
          disabled={loading}
          style={styles.btn}
        >
          Build My Plan
        </Button>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  progressBar: {
    height: 4,
    backgroundColor: COLORS.border,
  },
  progressFill: {
    height: 4,
    backgroundColor: COLORS.primary,
  },
  scroll: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 60,
  },
  stepContent: { flex: 1, gap: 16 },
  emoji: { fontSize: 64, textAlign: 'center', marginBottom: 8 },
  heading: { color: COLORS.text, fontWeight: 'bold', textAlign: 'center' },
  subtitle: { color: COLORS.textSecondary, textAlign: 'center', lineHeight: 24 },
  input: { backgroundColor: COLORS.bgCard },
  btn: { borderRadius: 12, flex: 1 },
  btnSecondary: { borderRadius: 12 },
  btnContent: { paddingVertical: 6 },
  navRow: { flexDirection: 'row', gap: 12, marginTop: 8, justifyContent: 'flex-end' },
  choiceCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
  },
  choiceCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}20`,
  },
  choiceText: { color: COLORS.textSecondary, fontSize: 16 },
  choiceTextSelected: { color: COLORS.primary, fontWeight: 'bold' },
  freqRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, flexWrap: 'wrap' },
  freqBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bgCard,
  },
  freqBtnSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  freqText: { color: COLORS.textSecondary, fontSize: 20, fontWeight: 'bold' },
  freqTextSelected: { color: COLORS.text },
});
