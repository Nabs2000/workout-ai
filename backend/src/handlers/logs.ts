import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { ok, err } from '../utils/response';
import { putItem, queryItems, Tables } from '../utils/dynamodb';

interface LoggedSet {
  reps: number;
  weight?: number;
}

interface LoggedExercise {
  name: string;
  muscleGroup: string;
  sets: LoggedSet[];
  durationSeconds?: number;
}

interface WorkoutLog {
  logId: string;
  userId: string;
  planId?: string;
  dayOfWeek: number;
  date: string;
  weekNumber: number;
  year: number;
  exercises: LoggedExercise[];
  durationMinutes: number;
  perceivedDifficulty: number;
  notes?: string;
  completedAt: string;
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const method = event.httpMethod;
    const path = event.resource;

    // POST /logs
    if (method === 'POST' && path === '/logs') {
      const body = JSON.parse(event.body ?? '{}');
      const { userId, exercises, weekNumber, year, dayOfWeek, date, durationMinutes, perceivedDifficulty, notes, planId } = body;

      if (!userId || !exercises || weekNumber === undefined || year === undefined) {
        return err('Missing required fields', 400);
      }

      const log: WorkoutLog = {
        logId: uuidv4(),
        userId,
        planId,
        dayOfWeek,
        date: date ?? new Date().toISOString().split('T')[0],
        weekNumber,
        year,
        exercises,
        durationMinutes: durationMinutes ?? 45,
        perceivedDifficulty: perceivedDifficulty ?? 3,
        notes,
        completedAt: new Date().toISOString(),
      };

      await putItem(Tables.logs, log as unknown as Record<string, unknown>);
      return ok(log);
    }

    // GET /logs/{userId}/{year}/{weekNumber}
    if (method === 'GET' && path === '/logs/{userId}/{year}/{weekNumber}') {
      const userId = event.pathParameters?.userId;
      const year = parseInt(event.pathParameters?.year ?? '0', 10);
      const weekNumber = parseInt(event.pathParameters?.weekNumber ?? '0', 10);

      if (!userId) return err('Missing userId', 400);

      const logs = await queryItems<WorkoutLog>(
        Tables.logs,
        '#uid = :uid',
        { '#uid': 'userId' },
        { ':uid': userId },
      );

      const filtered = logs.filter((l) => l.year === year && l.weekNumber === weekNumber);
      return ok(filtered);
    }

    // GET /logs/{userId}/recent
    if (method === 'GET' && path === '/logs/{userId}/recent') {
      const userId = event.pathParameters?.userId;
      if (!userId) return err('Missing userId', 400);

      const limit = parseInt(event.queryStringParameters?.limit ?? '10', 10);

      const logs = await queryItems<WorkoutLog>(
        Tables.logs,
        '#uid = :uid',
        { '#uid': 'userId' },
        { ':uid': userId },
      );

      return ok(logs.slice(0, limit));
    }

    return err('Not found', 404);
  } catch (e: any) {
    console.error('Logs handler error:', e);
    return err(e.message ?? 'Internal server error');
  }
}
