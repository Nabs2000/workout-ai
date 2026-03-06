/**
 * analyze.ts — The core Agentic AI handler for FitCoach AI.
 *
 * Uses Amazon Nova via the Bedrock Converse API with tool use (function calling).
 * Nova acts as a fitness coach agent that:
 *   1. Calls getWorkoutLogs()     — sees what the user actually did this week
 *   2. Calls getWorkoutPlan()     — sees what was planned
 *   3. Calls getUserProfile()     — understands the user's goals
 *   4. Calls updateWorkoutPlan()  — optionally rewrites next week's plan
 *   5. Returns a plain-language summary with adherence score and insights
 *
 * This multi-step tool-use loop is what qualifies this for the
 * Amazon Nova Hackathon "Agentic AI" category.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { ok, err, notFound } from '../utils/response';
import { getItem, putItem, queryItems, Tables } from '../utils/dynamodb';
import { invokeNovaWithTools } from '../utils/bedrock';
import { getCurrentWeek } from '../utils/weekUtils';
import { ToolConfiguration } from '@aws-sdk/client-bedrock-runtime';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  userId: string;
  name: string;
  goal: string;
  fitnessLevel: string;
  equipment: string;
  workoutsPerWeek: number;
}

interface LoggedSet { reps: number; weight?: number }
interface LoggedExercise { name: string; muscleGroup: string; sets: LoggedSet[] }
interface WorkoutLog {
  logId: string; userId: string; dayOfWeek: number; date: string;
  weekNumber: number; year: number; exercises: LoggedExercise[];
  durationMinutes: number; perceivedDifficulty: number; notes?: string;
}

interface Exercise {
  name: string; muscleGroup: string; sets: number; reps: number | string;
  restSeconds: number; notes?: string;
}
interface PlannedWorkout { dayOfWeek: number; name: string; exercises: Exercise[]; estimatedMinutes: number }
interface WorkoutPlan {
  planId: string; userId: string; weekNumber: number; year: number;
  workouts: PlannedWorkout[]; aiNotes?: string; createdAt: string; isCurrent: boolean;
}

interface WeeklyAnalysis {
  analysisId: string; userId: string; weekNumber: number; year: number;
  adherencePercent: number; summary: string; keyInsights: string[];
  planAdjusted: boolean; adjustmentReason?: string; createdAt: string;
}

// ─── Tool definitions for Nova ────────────────────────────────────────────────

const TOOLS: ToolConfiguration = {
  tools: [
    {
      toolSpec: {
        name: 'getWorkoutLogs',
        description: 'Retrieves the user\'s logged workouts for a specific week. Use this to see what exercises they actually completed.',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              userId: { type: 'string', description: 'The user ID' },
              weekNumber: { type: 'number', description: 'ISO week number (1-53)' },
              year: { type: 'number', description: 'The year' },
            },
            required: ['userId', 'weekNumber', 'year'],
          },
        },
      },
    },
    {
      toolSpec: {
        name: 'getWorkoutPlan',
        description: 'Retrieves the user\'s current workout plan showing what was scheduled for each day.',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              userId: { type: 'string', description: 'The user ID' },
            },
            required: ['userId'],
          },
        },
      },
    },
    {
      toolSpec: {
        name: 'getUserProfile',
        description: 'Retrieves the user\'s fitness profile including their goals, fitness level, and equipment.',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              userId: { type: 'string', description: 'The user ID' },
            },
            required: ['userId'],
          },
        },
      },
    },
    {
      toolSpec: {
        name: 'updateWorkoutPlan',
        description: 'Updates the user\'s workout plan for the next week. Call this when you determine the current plan needs adjustment based on performance data.',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              userId: { type: 'string', description: 'The user ID' },
              updatedWorkouts: {
                type: 'array',
                description: 'The new list of planned workouts for next week',
                items: {
                  type: 'object',
                  properties: {
                    dayOfWeek: { type: 'number', description: '0=Monday, 6=Sunday' },
                    name: { type: 'string' },
                    estimatedMinutes: { type: 'number' },
                    exercises: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          name: { type: 'string' },
                          muscleGroup: { type: 'string' },
                          sets: { type: 'number' },
                          reps: {},
                          restSeconds: { type: 'number' },
                          notes: { type: 'string' },
                        },
                        required: ['name', 'muscleGroup', 'sets', 'reps', 'restSeconds'],
                      },
                    },
                  },
                  required: ['dayOfWeek', 'name', 'exercises', 'estimatedMinutes'],
                },
              },
              aiNotes: { type: 'string', description: 'Explanation of why the plan was changed' },
            },
            required: ['userId', 'updatedWorkouts', 'aiNotes'],
          },
        },
      },
    },
    {
      toolSpec: {
        name: 'recordAnalysisResult',
        description: 'Records the final analysis result including adherence score and key insights. Always call this as the final step.',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              adherencePercent: { type: 'number', description: 'Percentage of planned workouts completed (0-100)' },
              summary: { type: 'string', description: 'A 2-3 sentence plain-language summary for the user' },
              keyInsights: {
                type: 'array',
                items: { type: 'string' },
                description: '3-5 specific actionable insights based on the data',
              },
              planAdjusted: { type: 'boolean', description: 'Whether updateWorkoutPlan was called' },
              adjustmentReason: { type: 'string', description: 'If plan was adjusted, why' },
            },
            required: ['adherencePercent', 'summary', 'keyInsights', 'planAdjusted'],
          },
        },
      },
    },
  ],
};

const AGENT_SYSTEM_PROMPT = `You are FitCoach AI — an expert personal trainer and sports scientist.
Your job is to analyze a user's weekly workout performance and provide actionable coaching feedback.

You have access to tools to:
1. Retrieve the user's workout logs (what they actually did)
2. Retrieve their current plan (what was scheduled)
3. Get their profile (goals, fitness level)
4. Update their plan for next week if needed
5. Record your analysis result

PROCESS:
1. Always start by fetching logs, plan, and profile
2. Calculate adherence (completed workouts / planned workouts × 100)
3. Analyze performance quality (effort levels, consistency, missed muscle groups)
4. Decide whether to adjust the plan based on:
   - < 60% adherence → simplify the plan (fewer/shorter workouts)
   - ≥ 60% adherence + perceived difficulty ≤ 2 consistently → increase intensity
   - Missed specific muscle groups consistently → rebalance
   - Good adherence (≥ 80%) → minor progressive overload adjustments
5. If adjusting the plan, call updateWorkoutPlan with the full revised plan
6. Always call recordAnalysisResult as your final action

Be encouraging but honest. Use specific data from their logs. Keep the summary conversational (2-3 sentences max).
Key insights should be specific and actionable, not generic.`;

// ─── Types for mutable state inside handler ───────────────────────────────────

type PendingPlanUpdate = { workouts: PlannedWorkout[]; aiNotes: string };
type PendingAnalysisResult = Omit<WeeklyAnalysis, 'analysisId' | 'userId' | 'weekNumber' | 'year' | 'createdAt'>;

// ─── Lambda handler ───────────────────────────────────────────────────────────

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const method = event.httpMethod;
    const path = event.resource;

    // POST /analyze/weekly
    if (method === 'POST' && path === '/analyze/weekly') {
      const body = JSON.parse(event.body ?? '{}');
      const { userId, weekNumber, year } = body;

      if (!userId) return err('Missing userId', 400);

      // Local mutable state for this invocation (avoids module-level mutation)
      let pendingPlanUpdate: PendingPlanUpdate | null = null;
      let pendingAnalysisResult: PendingAnalysisResult | null = null;

      const { week: currentWeek, year: currentYear } = getCurrentWeek();
      const targetWeek = weekNumber ?? currentWeek;
      const targetYear = year ?? currentYear;

      // Build tool handlers that close over userId, weekNumber, year
      const toolHandlers: Record<string, (input: unknown) => Promise<unknown>> = {
        getWorkoutLogs: async (input: unknown) => {
          const { userId: uid, weekNumber: wk, year: yr } = input as any;
          const logs = await queryItems<WorkoutLog>(
            Tables.logs,
            '#uid = :uid',
            { '#uid': 'userId' },
            { ':uid': uid ?? userId },
          );
          return logs.filter((l) => l.year === (yr ?? targetYear) && l.weekNumber === (wk ?? targetWeek));
        },

        getWorkoutPlan: async (input: unknown) => {
          const { userId: uid } = input as any;
          const plans = await queryItems<WorkoutPlan>(
            Tables.plans,
            '#uid = :uid',
            { '#uid': 'userId' },
            { ':uid': uid ?? userId },
          );
          return plans.find((p) => p.isCurrent) ?? plans[0] ?? null;
        },

        getUserProfile: async (input: unknown) => {
          const { userId: uid } = input as any;
          return getItem<UserProfile>(Tables.users, { userId: uid ?? userId });
        },

        updateWorkoutPlan: async (input: unknown) => {
          const { userId: uid, updatedWorkouts, aiNotes } = input as any;
          pendingPlanUpdate = { workouts: updatedWorkouts, aiNotes };
          return { success: true, message: 'Plan update queued' };
        },

        recordAnalysisResult: async (input: unknown) => {
          pendingAnalysisResult = input as typeof pendingAnalysisResult;
          return { success: true };
        },
      };

      // Run the agentic loop
      const { finalText, toolCallCount } = await invokeNovaWithTools(
        AGENT_SYSTEM_PROMPT,
        [
          {
            role: 'user',
            content: `Please analyze my workout progress for week ${targetWeek} of ${targetYear}.
My user ID is: ${userId}
Fetch my data, analyze my performance, and give me feedback. If my plan needs adjusting, please update it.`,
          },
        ],
        TOOLS,
        toolHandlers,
        15,
      );

      console.log(`Nova made ${toolCallCount} tool calls`);

      // Apply the plan update if Nova decided one was needed
      if (pendingPlanUpdate !== null) {
        const planUpdate: PendingPlanUpdate = pendingPlanUpdate;
        const existingPlans = await queryItems<WorkoutPlan>(
          Tables.plans,
          '#uid = :uid',
          { '#uid': 'userId' },
          { ':uid': userId },
        );

        for (const prev of existingPlans) {
          if (prev.isCurrent) {
            await putItem(Tables.plans, { ...prev, isCurrent: false } as unknown as Record<string, unknown>);
          }
        }

        const { week: nextWeek, year: nextYear } = getNextWeek(targetWeek, targetYear);
        const newPlan: WorkoutPlan = {
          planId: `${nextYear}-W${nextWeek}-${uuidv4().slice(0, 8)}`,
          userId,
          weekNumber: nextWeek,
          year: nextYear,
          workouts: planUpdate.workouts,
          aiNotes: planUpdate.aiNotes,
          createdAt: new Date().toISOString(),
          isCurrent: true,
        };
        await putItem(Tables.plans, newPlan as unknown as Record<string, unknown>);
      }

      // Build and save the analysis record
      // Use explicit cast: pendingPlanUpdate is set inside a closure, which TS strict
      // control-flow analysis cannot track, so we assert the type here.
      const capturedPlanUpdate = pendingPlanUpdate as PendingPlanUpdate | null;
      const planUpdated = capturedPlanUpdate !== null;
      const analysisData = pendingAnalysisResult ?? {
        adherencePercent: 0,
        summary: finalText || 'Analysis complete. Keep working toward your goals!',
        keyInsights: [],
        planAdjusted: planUpdated,
        adjustmentReason: capturedPlanUpdate?.aiNotes,
      };

      const analysis: WeeklyAnalysis = {
        analysisId: uuidv4(),
        userId,
        weekNumber: targetWeek,
        year: targetYear,
        ...analysisData,
        planAdjusted: planUpdated,
        createdAt: new Date().toISOString(),
      };

      await putItem(Tables.analyses, analysis as unknown as Record<string, unknown>);
      return ok(analysis);
    }

    // GET /analyze/{userId}/latest
    if (method === 'GET' && path === '/analyze/{userId}/latest') {
      const userId = event.pathParameters?.userId;
      if (!userId) return err('Missing userId', 400);

      const analyses = await queryItems<WeeklyAnalysis>(
        Tables.analyses,
        '#uid = :uid',
        { '#uid': 'userId' },
        { ':uid': userId },
      );

      return ok(analyses[0] ?? null); // queryItems returns newest first
    }

    return err('Not found', 404);
  } catch (e: any) {
    console.error('Analyze handler error:', e);
    return err(e.message ?? 'Internal server error');
  }
}

function getNextWeek(week: number, year: number): { week: number; year: number } {
  if (week < 52) return { week: week + 1, year };
  // Handle year boundary (week 53 or overflow)
  return { week: 1, year: year + 1 };
}
