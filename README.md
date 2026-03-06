# FitCoach AI

> Amazon Nova Hackathon submission — Agentic AI category

A mobile workout tracker where an Amazon Nova AI agent creates personalized training plans, monitors weekly progress, and **autonomously adjusts your plan** based on actual performance data.

## How the Agentic AI Works

The core of this app is a multi-step tool-use loop powered by **Amazon Nova Lite** via Amazon Bedrock:

```
User triggers "Analyze my week"
        │
        ▼
Nova calls getWorkoutLogs()     ← what did you actually do?
        │
        ▼
Nova calls getWorkoutPlan()     ← what was scheduled?
        │
        ▼
Nova calls getUserProfile()     ← what are your goals?
        │
        ▼
Nova decides: does the plan need changing?
        │
   ┌────┴────┐
  YES       NO
   │         │
Nova calls   Nova skips
updatePlan() updatePlan()
   │         │
   └────┬────┘
        │
        ▼
Nova calls recordAnalysisResult()
  • adherence %
  • plain-language summary
  • 3-5 key insights
        │
        ▼
Result shown to user + plan updated in DB
```

This qualifies for the **Agentic AI** hackathon track: Nova autonomously gathers data through multiple tool calls, reasons about it, and takes action (plan update) without human intervention between steps.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native (Expo SDK 54) |
| Routing | Expo Router (file-based) |
| State | Zustand + TanStack Query |
| Backend | AWS Lambda (Node.js 20) |
| API | AWS API Gateway (REST) |
| Database | Amazon DynamoDB (4 tables) |
| AI | Amazon Bedrock — Nova Lite (tool use) |
| IaC | AWS SAM |

## Project Structure

```
workout-ai/
├── frontend/           # Expo React Native app
│   ├── app/
│   │   ├── _layout.tsx         # Root layout (QueryClient, PaperProvider)
│   │   ├── index.tsx           # Entry: routes to onboarding or tabs
│   │   ├── onboarding.tsx      # 5-step onboarding flow
│   │   └── (tabs)/
│   │       ├── index.tsx       # Home — today's workout + AI insight
│   │       ├── plan.tsx        # Full weekly plan view
│   │       ├── log.tsx         # Log a workout (sets, reps, weight)
│   │       ├── progress.tsx    # Stats, adherence chart, AI analysis
│   │       └── coach.tsx       # Chat UI with Nova AI coach
│   ├── services/
│   │   ├── api.ts              # Typed API client (axios)
│   │   └── storage.ts          # AsyncStorage wrapper
│   ├── stores/userStore.ts     # Zustand user store
│   ├── types/index.ts          # Shared TypeScript types
│   └── constants/index.ts      # Colors, labels, emoji maps
│
└── backend/            # AWS SAM backend
    ├── template.yaml           # SAM template (API GW + Lambda + DynamoDB)
    ├── src/
    │   ├── handlers/
    │   │   ├── users.ts        # POST /users, GET /users/:id
    │   │   ├── plans.ts        # POST /plans/generate (Nova), GET /plans/...
    │   │   ├── logs.ts         # POST /logs, GET /logs/...
    │   │   ├── analyze.ts      # POST /analyze/weekly (Nova agent loop)
    │   │   └── progress.ts     # GET /progress/:userId
    │   └── utils/
    │       ├── bedrock.ts      # invokeNova() + invokeNovaWithTools()
    │       ├── dynamodb.ts     # Typed DynamoDB helpers
    │       ├── response.ts     # Lambda response helpers
    │       └── weekUtils.ts    # ISO week calculation
    └── env.local.json          # Local dev environment variables
```

## Setup

### Prerequisites

- Node.js 20+
- [AWS CLI](https://aws.amazon.com/cli/) configured (`aws configure`)
- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npm install -g expo-cli`)
- Amazon Bedrock access to **amazon.nova-lite-v1:0** enabled in your AWS account
  - Go to AWS Console → Bedrock → Model access → Enable Amazon Nova Lite

### 1. Deploy the backend

```bash
cd backend
npm install
npm run build          # compiles TypeScript to dist/
sam deploy --guided    # first time: walks you through config
```

After deploy, copy the `ApiUrl` from the output. It looks like:
```
https://abc123def.execute-api.us-east-1.amazonaws.com/dev
```

### 2. Configure the frontend

```bash
cd frontend
cp .env.example .env.local
# Edit .env.local and set EXPO_PUBLIC_API_URL to your ApiUrl
```

### 3. Run the app

```bash
cd frontend
npx expo start
```

Scan the QR code with the **Expo Go** app on your phone, or press `w` for web.

### Local development (backend)

To test the backend locally without deploying:

```bash
# Terminal 1 — start DynamoDB Local (requires Docker)
docker run -p 8000:8000 amazon/dynamodb-local

# Terminal 2 — create local tables
aws dynamodb create-table --table-name fitcoach-users-dev \
  --attribute-definitions AttributeName=userId,AttributeType=S \
  --key-schema AttributeName=userId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url http://localhost:8000

# Repeat for fitcoach-plans-dev, fitcoach-logs-dev, fitcoach-analyses-dev

# Terminal 3 — start SAM local API
cd backend && sam local start-api --env-vars env.local.json
```

Then set `EXPO_PUBLIC_API_URL=http://localhost:3000` in your frontend `.env.local`.

## Nova Model

The app uses **amazon.nova-lite-v1:0** by default (fast + cost-effective). To switch to Nova Pro for higher quality plan generation, update `NOVA_MODEL_ID` in `template.yaml`:

```yaml
NOVA_MODEL_ID: amazon.nova-pro-v1:0
```

## DynamoDB Tables

| Table | Partition Key | Sort Key | Purpose |
|-------|--------------|----------|---------|
| fitcoach-users | userId | — | User profiles & goals |
| fitcoach-plans | userId | planId | Generated workout plans |
| fitcoach-logs | userId | logId | Logged workout sessions |
| fitcoach-analyses | userId | analysisId | Nova AI analysis results |

## Hackathon Notes

- **Category**: Agentic AI
- **Nova features used**: Tool use (function calling), multi-turn reasoning, plan generation
- **Agentic behavior**: Nova autonomously decides whether to update the training plan based on analyzed data — without user prompting each step
