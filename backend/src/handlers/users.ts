import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ok, err, notFound } from '../utils/response';
import { getItem, putItem, Tables } from '../utils/dynamodb';

interface UserProfile {
  userId: string;
  name: string;
  goal: string;
  fitnessLevel: string;
  equipment: string;
  workoutsPerWeek: number;
  createdAt: string;
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const method = event.httpMethod;
    const path = event.resource;

    // POST /users
    if (method === 'POST' && path === '/users') {
      const body = JSON.parse(event.body ?? '{}');
      const { userId, name, goal, fitnessLevel, equipment, workoutsPerWeek } = body;

      if (!userId || !name || !goal) {
        return err('Missing required fields: userId, name, goal', 400);
      }

      const user: UserProfile = {
        userId,
        name,
        goal,
        fitnessLevel: fitnessLevel ?? 'beginner',
        equipment: equipment ?? 'full_gym',
        workoutsPerWeek: workoutsPerWeek ?? 3,
        createdAt: new Date().toISOString(),
      };

      await putItem(Tables.users, user as unknown as Record<string, unknown>);
      return ok(user);
    }

    // GET /users/{userId}
    if (method === 'GET' && path === '/users/{userId}') {
      const userId = event.pathParameters?.userId;
      if (!userId) return err('Missing userId', 400);

      const user = await getItem<UserProfile>(Tables.users, { userId });
      if (!user) return notFound('User not found');
      return ok(user);
    }

    return err('Not found', 404);
  } catch (e: any) {
    console.error('Users handler error:', e);
    return err(e.message ?? 'Internal server error');
  }
}
