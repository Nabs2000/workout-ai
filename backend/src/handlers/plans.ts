import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { ok, err, notFound } from '../utils/response';
import { getItem, putItem, queryItems, Tables } from '../utils/dynamodb';
import { invokeNova } from '../utils/bedrock';
import { getCurrentWeek } from '../utils/weekUtils';

interface UserProfile {
  userId: string;
  name: string;
  goal: string;
  fitnessLevel: string;
  equipment: string;
  workoutsPerWeek: number;
}

interface Exercise {
  name: string;
  muscleGroup: string;
  sets: number;
  reps: number | string;
  restSeconds: number;
  notes?: string;
}

interface PlannedWorkout {
  dayOfWeek: number;
  name: string;
  exercises: Exercise[];
  estimatedMinutes: number;
}

interface WorkoutPlan {
  planId: string;
  userId: string;
  weekNumber: number;
  year: number;
  workouts: PlannedWorkout[];
  aiNotes: string;
  createdAt: string;
  isCurrent: boolean;
}

const PLAN_SYSTEM_PROMPT = `You are an expert personal trainer and exercise scientist.
Your job is to create personalized, evidence-based workout plans.

IMPORTANT: Respond ONLY with valid JSON — no markdown, no explanation, just the JSON object.

The JSON must follow this exact schema:
{
  "workouts": [
    {
      "dayOfWeek": 0,  // 0=Monday, 6=Sunday
      "name": "Upper Body Strength",
      "estimatedMinutes": 45,
      "exercises": [
        {
          "name": "Barbell Bench Press",
          "muscleGroup": "chest",
          "sets": 4,
          "reps": 8,
          "restSeconds": 90,
          "notes": "Keep elbows at 45 degrees"
        }
      ]
    }
  ],
  "aiNotes": "Brief explanation of the plan structure and rationale"
}

muscleGroup must be one of: chest, back, shoulders, arms, legs, core, cardio, full_body
Schedule rest days appropriately. Do not include rest days in the workouts array.`;

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const method = event.httpMethod;
    const path = event.resource;

    // POST /plans/generate
    if (method === 'POST' && path === '/plans/generate') {
      const body = JSON.parse(event.body ?? '{}');
      const { userId } = body;
      if (!userId) return err('Missing userId', 400);

      const user = await getItem<UserProfile>(Tables.users, { userId });
      if (!user) return notFound('User not found');

      const prompt = buildPlanPrompt(user);
      const rawJson = await invokeNova(PLAN_SYSTEM_PROMPT, [{ role: 'user', content: prompt }]);

      let parsed: { workouts: PlannedWorkout[]; aiNotes: string };
      try {
        // Strip any accidental markdown fences
        const clean = rawJson.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(clean);
      } catch {
        console.error('Failed to parse Nova plan JSON:', rawJson);
        return err('AI returned invalid JSON. Please try again.');
      }

      const { week, year } = getCurrentWeek();
      const plan: WorkoutPlan = {
        planId: `${year}-W${week}-${uuidv4().slice(0, 8)}`,
        userId,
        weekNumber: week,
        year,
        workouts: parsed.workouts,
        aiNotes: parsed.aiNotes,
        createdAt: new Date().toISOString(),
        isCurrent: true,
      };

      // Mark all previous plans as not current
      const previousPlans = await queryItems<WorkoutPlan>(
        Tables.plans,
        '#uid = :uid',
        { '#uid': 'userId' },
        { ':uid': userId },
      );
      for (const prev of previousPlans) {
        if (prev.isCurrent) {
          await putItem(Tables.plans, { ...prev, isCurrent: false } as unknown as Record<string, unknown>);
        }
      }

      await putItem(Tables.plans, plan as unknown as Record<string, unknown>);
      return ok(plan);
    }

    // GET /plans/current/{userId}
    if (method === 'GET' && path === '/plans/current/{userId}') {
      const userId = event.pathParameters?.userId;
      if (!userId) return err('Missing userId', 400);

      const plans = await queryItems<WorkoutPlan>(
        Tables.plans,
        '#uid = :uid',
        { '#uid': 'userId' },
        { ':uid': userId },
      );

      const current = plans.find((p) => p.isCurrent) ?? plans[0] ?? null;
      return ok(current);
    }

    // GET /plans/{userId}/{year}/{weekNumber}
    if (method === 'GET' && path === '/plans/{userId}/{year}/{weekNumber}') {
      const userId = event.pathParameters?.userId;
      const year = parseInt(event.pathParameters?.year ?? '0', 10);
      const weekNumber = parseInt(event.pathParameters?.weekNumber ?? '0', 10);

      if (!userId) return err('Missing userId', 400);

      const plans = await queryItems<WorkoutPlan>(
        Tables.plans,
        '#uid = :uid',
        { '#uid': 'userId' },
        { ':uid': userId },
      );

      const plan = plans.find((p) => p.weekNumber === weekNumber && p.year === year) ?? null;
      return ok(plan);
    }

    return err('Not found', 404);
  } catch (e: any) {
    console.error('Plans handler error:', e);
    return err(e.message ?? 'Internal server error');
  }
}

function buildPlanPrompt(user: UserProfile): string {
  const goalDescriptions: Record<string, string> = {
    lose_weight: 'fat loss and calorie burn through a mix of strength and cardio',
    build_muscle: 'hypertrophy and muscle building with progressive overload',
    improve_endurance: 'cardiovascular endurance and aerobic capacity',
    stay_active: 'general fitness, health, and staying active',
  };

  const equipmentDescriptions: Record<string, string> = {
    none: 'no equipment (bodyweight exercises only)',
    dumbbells: 'dumbbells only (no barbell, no machines)',
    home_gym: 'home gym (dumbbells, barbell, pull-up bar, resistance bands)',
    full_gym: 'full commercial gym access (all machines, barbells, cables)',
  };

  return `Create a weekly workout plan for this person:
- Name: ${user.name}
- Primary goal: ${goalDescriptions[user.goal] ?? user.goal}
- Fitness level: ${user.fitnessLevel}
- Available equipment: ${equipmentDescriptions[user.equipment] ?? user.equipment}
- Training days per week: ${user.workoutsPerWeek}

Design a plan with exactly ${user.workoutsPerWeek} workout days spread across the week.
Include appropriate rest days. Tailor exercise selection, volume, and intensity to their level and goal.`;
}
