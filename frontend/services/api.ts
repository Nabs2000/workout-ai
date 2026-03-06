import axios from 'axios';
import {
  UserProfile,
  WorkoutPlan,
  WorkoutLog,
  WeeklyAnalysis,
  ProgressStats,
  ApiResponse,
} from '../types';

// Set this to your deployed API Gateway URL after deploying the backend.
// For local testing, you can use the SAM local URL: http://localhost:3000
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 60000, // AI calls can be slow
  headers: { 'Content-Type': 'application/json' },
});

// Attach userId header to every request
client.interceptors.request.use((config) => {
  // userId is injected via the store — imported here lazily to avoid circular deps
  const { useUserStore } = require('../stores/userStore');
  const userId = useUserStore.getState().userId;
  if (userId) config.headers['x-user-id'] = userId;
  return config;
});

async function call<T>(fn: () => Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const res = await fn();
  if (!res.data.success || !res.data.data) {
    throw new Error(res.data.error ?? 'API error');
  }
  return res.data.data;
}

// ─── User ─────────────────────────────────────────────────────────────────────

export const api = {
  user: {
    create: (profile: Omit<UserProfile, 'createdAt'>) =>
      call<UserProfile>(() => client.post('/users', profile)),

    get: (userId: string) =>
      call<UserProfile>(() => client.get(`/users/${userId}`)),
  },

  // ─── Plans ──────────────────────────────────────────────────────────────────

  plan: {
    generate: (userId: string) =>
      call<WorkoutPlan>(() => client.post('/plans/generate', { userId })),

    getCurrent: (userId: string) =>
      call<WorkoutPlan | null>(() => client.get(`/plans/current/${userId}`)),

    getByWeek: (userId: string, weekNumber: number, year: number) =>
      call<WorkoutPlan | null>(() =>
        client.get(`/plans/${userId}/${year}/${weekNumber}`)),
  },

  // ─── Logs ───────────────────────────────────────────────────────────────────

  log: {
    create: (log: Omit<WorkoutLog, 'logId' | 'completedAt'>) =>
      call<WorkoutLog>(() => client.post('/logs', log)),

    getByWeek: (userId: string, weekNumber: number, year: number) =>
      call<WorkoutLog[]>(() =>
        client.get(`/logs/${userId}/${year}/${weekNumber}`)),

    getRecent: (userId: string, limit = 10) =>
      call<WorkoutLog[]>(() =>
        client.get(`/logs/${userId}/recent?limit=${limit}`)),
  },

  // ─── AI Analysis ────────────────────────────────────────────────────────────

  analyze: {
    runWeekly: (userId: string, weekNumber: number, year: number) =>
      call<WeeklyAnalysis>(() =>
        client.post('/analyze/weekly', { userId, weekNumber, year })),

    getLatest: (userId: string) =>
      call<WeeklyAnalysis | null>(() =>
        client.get(`/analyze/${userId}/latest`)),
  },

  // ─── Progress ────────────────────────────────────────────────────────────────

  progress: {
    getStats: (userId: string) =>
      call<ProgressStats>(() => client.get(`/progress/${userId}`)),
  },
};
