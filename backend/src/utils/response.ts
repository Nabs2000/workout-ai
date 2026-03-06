import { APIGatewayProxyResult } from 'aws-lambda';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': '*',
};

export function ok<T>(data: T): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ success: true, data }),
  };
}

export function err(message: string, status = 500): APIGatewayProxyResult {
  return {
    statusCode: status,
    headers: CORS,
    body: JSON.stringify({ success: false, error: message }),
  };
}

export function notFound(message = 'Not found'): APIGatewayProxyResult {
  return err(message, 404);
}
