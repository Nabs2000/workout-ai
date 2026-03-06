import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ok, err } from '../utils/response';
import { queryItems, Tables } from '../utils/dynamodb';
import { getCurrentWeek } from '../utils/weekUtils';

interface LoggedExercise { muscleGroup: string }
interface WorkoutLog {
  logId: string; userId: string; date: string; weekNumber: number; year: number;
  exercises: LoggedExercise[]; durationMinutes: number; perceivedDifficulty: number;
  completedAt: string;
}

interface WeeklyAnalysis {
  weekNumber: number; year: number; adherencePercent: number;
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const userId = event.pathParameters?.userId;
    if (!userId) return err('Missing userId', 400);

    const [logs, analyses] = await Promise.all([
      queryItems<WorkoutLog>(
        Tables.logs,
        '#uid = :uid',
        { '#uid': 'userId' },
        { ':uid': userId },
      ),
      queryItems<WeeklyAnalysis>(
        Tables.analyses,
        '#uid = :uid',
        { '#uid': 'userId' },
        { ':uid': userId },
      ),
    ]);

    // Total stats
    const totalWorkouts = logs.length;
    const totalMinutes = logs.reduce((sum, l) => sum + (l.durationMinutes ?? 0), 0);
    const avgDifficulty = logs.length > 0
      ? logs.reduce((sum, l) => sum + (l.perceivedDifficulty ?? 3), 0) / logs.length
      : 0;

    // Streak (consecutive days with a log, working backwards from today)
    const logDates = new Set(logs.map((l) => l.date));
    let currentStreak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      if (logDates.has(dateStr)) {
        currentStreak++;
      } else if (i > 0) {
        break;
      }
    }

    // Weekly adherence for last 8 weeks
    const { week: currentWeek, year: currentYear } = getCurrentWeek();
    const weeklyAdherence: number[] = [];
    for (let i = 7; i >= 0; i--) {
      const targetWeek = currentWeek - i;
      const adj = analyses.find((a) => a.weekNumber === targetWeek && a.year === currentYear);
      weeklyAdherence.push(adj?.adherencePercent ?? 0);
    }

    // Most trained muscle group
    const muscleCounts: Record<string, number> = {};
    for (const log of logs) {
      for (const ex of log.exercises) {
        muscleCounts[ex.muscleGroup] = (muscleCounts[ex.muscleGroup] ?? 0) + 1;
      }
    }
    const mostTrainedMuscle = Object.keys(muscleCounts).length > 0
      ? Object.entries(muscleCounts).sort((a, b) => b[1] - a[1])[0][0]
      : null;

    return ok({
      totalWorkouts,
      totalMinutes,
      currentStreak,
      weeklyAdherence,
      avgDifficulty: Math.round(avgDifficulty * 10) / 10,
      mostTrainedMuscle,
    });
  } catch (e: any) {
    console.error('Progress handler error:', e);
    return err(e.message ?? 'Internal server error');
  }
}
