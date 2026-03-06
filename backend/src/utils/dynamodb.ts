import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.REGION ?? 'us-east-1' });
export const db = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

export const Tables = {
  users: process.env.USERS_TABLE!,
  plans: process.env.PLANS_TABLE!,
  logs: process.env.LOGS_TABLE!,
  analyses: process.env.ANALYSES_TABLE!,
};

// ─── Typed helpers ────────────────────────────────────────────────────────────

export async function getItem<T>(table: string, key: Record<string, string>): Promise<T | null> {
  const res = await db.send(new GetCommand({ TableName: table, Key: key }));
  return (res.Item as T) ?? null;
}

export async function putItem(table: string, item: Record<string, unknown>): Promise<void> {
  await db.send(new PutCommand({ TableName: table, Item: item }));
}

export async function queryItems<T>(
  table: string,
  keyCondition: string,
  names: Record<string, string>,
  values: Record<string, unknown>,
  indexName?: string,
): Promise<T[]> {
  const res = await db.send(
    new QueryCommand({
      TableName: table,
      IndexName: indexName,
      KeyConditionExpression: keyCondition,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ScanIndexForward: false, // newest first
    }),
  );
  return (res.Items as T[]) ?? [];
}
