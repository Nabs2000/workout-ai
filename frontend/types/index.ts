// ─── User & Goals ────────────────────────────────────────────────────────────

export type FitnessGoal = 'lose_weight' | 'build_muscle' | 'improve_endurance' | 'stay_active';
export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced';
export type Equipment = 'none' | 'dumbbells' | 'full_gym' | 'home_gym';

export interface UserProfile {
  userId: string;
  name: string;
  goal: FitnessGoal;
  fitnessLevel: FitnessLevel;
  equipment: Equipment;
  workoutsPerWeek: number; // 2-6
  createdAt: string;
}

// ─── Workout Plan ─────────────────────────────────────────────────────────────

export type MuscleGroup =
  | 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core' | 'cardio' | 'full_body';

export interface Exercise {
  name: string;
  muscleGroup: MuscleGroup;
  sets: number;
  reps: number | string; // e.g. 12 or "30 seconds"
  restSeconds: number;
  notes?: string;
}

export interface PlannedWorkout {
  dayOfWeek: number; // 0=Mon ... 6=Sun
  name: string;      // e.g. "Upper Body Strength"
  exercises: Exercise[];
  estimatedMinutes: number;
}

export interface WorkoutPlan {
  planId: string;
  userId: string;
  weekNumber: number;   // week of the year
  year: number;
  workouts: PlannedWorkout[];
  aiNotes?: string;     // Nova's rationale for the plan
  createdAt: string;
}

// ─── Workout Log ──────────────────────────────────────────────────────────────

export interface LoggedSet {
  reps: number;
  weight?: number; // kg, undefined for bodyweight/cardio
}

export interface LoggedExercise {
  name: string;
  muscleGroup: MuscleGroup;
  sets: LoggedSet[];
  durationSeconds?: number; // for cardio
}

export interface WorkoutLog {
  logId: string;
  userId: string;
  planId?: string;           // which plan this was from (optional)
  dayOfWeek: number;
  date: string;              // ISO date string
  weekNumber: number;
  year: number;
  exercises: LoggedExercise[];
  durationMinutes: number;
  perceivedDifficulty: 1 | 2 | 3 | 4 | 5; // RPE simplified
  notes?: string;
  completedAt: string;
}

// ─── AI Analysis ─────────────────────────────────────────────────────────────

export interface WeeklyAnalysis {
  analysisId: string;
  userId: string;
  weekNumber: number;
  year: number;
  adherencePercent: number;       // 0-100
  summary: string;                // Nova's plain-language summary
  keyInsights: string[];          // bullet points
  planAdjusted: boolean;
  adjustmentReason?: string;
  createdAt: string;
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ProgressStats {
  totalWorkouts: number;
  totalMinutes: number;
  currentStreak: number;         // days
  weeklyAdherence: number[];     // last 8 weeks, percent
  avgDifficulty: number;
  mostTrainedMuscle: MuscleGroup | null;
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

export type TabRoute = 'index' | 'plan' | 'log' | 'progress' | 'coach';
