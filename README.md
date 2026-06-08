# StrideSmart

StrideSmart is a running analytics and coaching web app that connects to Strava, syncs your activity history, and helps you understand your training through charts, tables, and AI-powered race analysis and coaching.

## Features

- **Strava OAuth** — Sign in with your Strava account and automatically sync your activity history
- **Activity dashboard** — Sortable, paginated table of all synced runs and workouts with pace, distance, heart rate, and more
- **Performance charts** — Visualize weekly mileage, pace trends, activity types, and run scatter plots
- **AI training analysis** — Set a race goal (date, distance, target time) and get a personalized fitness assessment and training recommendations powered by OpenAI
- **AI coach chat** — Ask follow-up questions about your training with context from your recent Strava data
- **Training calendar** — Generate and manage a weekly workout plan, track completed sessions, and edit workouts on a calendar view

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| Frontend | React 18, React Router, Chart.js, react-table, Lucide icons |
| Backend | FastAPI, Uvicorn, Python 3.9+ |
| Database | MySQL |
| Integrations | Strava API v3, OpenAI (GPT-4o-mini) |
| Deployment | Heroku (separate frontend and backend apps) |

## Project Structure

```
StrideSmart/
├── Backend/
│   ├── main.py              # FastAPI app, Strava sync, LLM endpoints
│   ├── requirements.txt
│   ├── Procfile
│   └── runtime.txt
├── Frontend/
│   ├── src/
│   │   ├── App.js           # Routing and auth state
│   │   └── components/
│   │       ├── Dashboard.js
│   │       ├── ActivityTable.js
│   │       ├── Graphs.js
│   │       ├── UnifiedAITrainingPlan.js
│   │       └── loginComponent.js
│   ├── package.json
│   └── Procfile
└── README.md
```

## Prerequisites

- **Node.js** 20.x
- **Python** 3.9+
- A **Strava API application** ([create one here](https://www.strava.com/settings/api))
- A **MySQL** database (local or hosted, e.g. AWS RDS)
- An **OpenAI API key**

## Getting Started

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd StrideSmart
```

### 2. Set up the database

Create a MySQL database with two tables. The app expects at minimum:

**`users`** — stores Strava OAuth tokens per athlete

```sql
CREATE TABLE users (
    athlete_id BIGINT PRIMARY KEY,
    access_token VARCHAR(255) NOT NULL,
    refresh_token VARCHAR(255) NOT NULL,
    created_at DATETIME,
    updated_at DATETIME
);
```

**`activities`** — stores synced Strava activities

```sql
CREATE TABLE activities (
    id BIGINT PRIMARY KEY,
    name VARCHAR(255),
    distance FLOAT,
    moving_time INT,
    elapsed_time INT,
    total_elevation_gain FLOAT,
    type VARCHAR(50),
    start_date DATETIME,
    start_date_local DATETIME,
    timezone VARCHAR(100),
    average_speed FLOAT,
    max_speed FLOAT,
    average_cadence FLOAT,
    average_heartrate FLOAT,
    max_heartrate FLOAT,
    calories FLOAT,
    athlete_id BIGINT,
    INDEX idx_athlete_date (athlete_id, start_date)
);
```

### 3. Configure the backend

Create `Backend/.env` with the following variables:

```env
# Database
DB_HOST=your-db-host
DB_USER=your-db-user
DB_PASS=your-db-password
DB_NAME=your-db-name
DB_PORT=3306

# Strava OAuth
STRAVA_CLIENT_ID=your-strava-client-id
STRAVA_CLIENT_SECRET=your-strava-client-secret
STRAVA_AUTHORIZATION_URL=https://www.strava.com/oauth/authorize
STRAVA_TOKEN_URL=https://www.strava.com/oauth/token
STRAVA_REDIRECT_URI=http://127.0.0.1:8000/oauth2/callback

# App URLs
FRONTEND_URL=http://localhost:3000
SERVER_HOST=127.0.0.1
SERVER_PORT=8000

# OpenAI
OPENAI_API_KEY=your-openai-api-key

# Optional: tune LLM context and token limits
LLM_DETAIL_RUNS=15
LLM_WEEKLY_WEEKS=12
LLM_BEST_EFFORTS=5
LLM_ANALYZE_MAX_TOKENS=800
LLM_CHAT_MAX_TOKENS=450
LLM_MIN_RUN_MILES=3.0
STRAVA_REQUEST_DELAY=0.5
```

> **Important:** In your Strava app settings, set the **Authorization Callback Domain** to match your redirect URI (e.g. `127.0.0.1` for local development).

### 4. Configure the frontend

Create `Frontend/.env`:

```env
REACT_APP_API_URL=http://localhost:8000
```

### 5. Install dependencies

**Backend:**

```bash
cd Backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

**Frontend:**

```bash
cd Frontend
npm install
```

### 6. Run locally

Start the backend (from `Backend/`):

```bash
uvicorn main:app --reload
```

Start the frontend (from `Frontend/`):

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), click **Connect with Strava**, and authorize the app. Your full activity history will sync in the background after login.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Health check |
| `GET` | `/login` | Redirect to Strava OAuth |
| `GET` | `/oauth2/callback` | OAuth callback; stores tokens and triggers background sync |
| `POST` | `/sync?athlete_id={id}&full={bool}` | Sync activities from Strava (incremental or full backfill) |
| `GET` | `/training?athlete_id={id}` | Return all stored activities for an athlete |
| `GET` | `/activities/weeklysummary?athlete_id={id}` | Weekly mileage summary for charts |
| `POST` | `/llm/analyze` | AI race readiness analysis |
| `POST` | `/llm/chat` | AI coach chat with training context |

## Deployment (Heroku)

The project is set up for two Heroku apps — one for the backend and one for the frontend.

**Backend app:**
- Set all `Backend/.env` variables as Heroku config vars
- Update `STRAVA_REDIRECT_URI` and `FRONTEND_URL` to your production URLs
- Deploy from the `Backend/` directory; the `Procfile` runs Uvicorn

**Frontend app:**
- Set `REACT_APP_API_URL` to your backend Heroku URL
- Deploy from the `Frontend/` directory; `heroku-postbuild` builds the React app and `serve` serves it

## How It Works

1. User authenticates via Strava OAuth on the backend
2. Access and refresh tokens are stored in MySQL
3. A background task paginates through the athlete's full Strava history and upserts activities into the database
4. The frontend polls for synced data and renders the dashboard
5. For AI features, the backend builds a compact fitness context (weekly mileage, recent runs, best efforts) and sends it to OpenAI — keeping token usage and cost controlled

## License

Private project. All rights reserved.
