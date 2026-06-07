from fastapi import FastAPI, HTTPException, Request, Query, BackgroundTasks
from fastapi.responses import RedirectResponse
import requests
import mysql.connector
import time
from datetime import datetime, timedelta
from collections import defaultdict
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
from openai import OpenAI
from mysql.connector import Error



load_dotenv()

app = FastAPI()

##My Strava Data/Variable Data
CLIENT_ID = os.getenv('STRAVA_CLIENT_ID')
CLIENT_SECRET = os.getenv('STRAVA_CLIENT_SECRET')
AUTHORIZATION_URL = os.getenv('STRAVA_AUTHORIZATION_URL')
TOKEN_URL = os.getenv('STRAVA_TOKEN_URL')
REDIRECT_URI = os.getenv('STRAVA_REDIRECT_URI')
FRONTEND_URL = os.getenv('FRONTEND_URL')

STRAVA_ACTIVITIES_URL = "https://www.strava.com/api/v3/athlete/activities"
STRAVA_PER_PAGE = 200  # Strava max per page
STRAVA_REQUEST_DELAY = float(os.getenv('STRAVA_REQUEST_DELAY', '0.5'))
STRAVA_RATE_LIMIT_BUFFER = 5  # pause when this many requests from the 15-min cap

# LLM context limits (tune via .env to control OpenAI spend)
LLM_DETAIL_RUNS = int(os.getenv("LLM_DETAIL_RUNS", "15"))
LLM_WEEKLY_WEEKS = int(os.getenv("LLM_WEEKLY_WEEKS", "12"))
LLM_BEST_EFFORTS = int(os.getenv("LLM_BEST_EFFORTS", "5"))
LLM_ANALYZE_MAX_TOKENS = int(os.getenv("LLM_ANALYZE_MAX_TOKENS", "800"))
LLM_CHAT_MAX_TOKENS = int(os.getenv("LLM_CHAT_MAX_TOKENS", "450"))
LLM_MIN_RUN_MILES = float(os.getenv("LLM_MIN_RUN_MILES", "3.0"))

#initialize openai
openai_client=OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

# Debug: Print API key status (don't print actual key)
print(f"OpenAI API Key configured: {'Yes' if os.getenv('OPENAI_API_KEY') else 'No'}")

##Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL"),
                   "https://*.herokuapp.com",
                   "http://localhost:3000",
                   "http://localhost:3001"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

##Setting up my MySQL Connection
def create_connection():
    try:
        connection = mysql.connector.connect(
            host=os.getenv('DB_HOST'),
            database=os.getenv('DB_NAME'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASS'),
            port=int(os.getenv('DB_PORT',3306))
        )
        if connection.is_connected():
            print(os.getenv('DB_NAME'))
            return connection
    except Error as e:
        return None

##Helper Functions

def format_pace_per_mile(moving_time_seconds, distance_meters):
    """Convert pace to minutes per mile format (MM:SS) - FIXED VERSION"""
    if not distance_meters or distance_meters <= 0 or not moving_time_seconds or moving_time_seconds <= 0:
        return "N/A"
    
    # Convert to miles and calculate pace per mile
    distance_miles = meters_to_miles(distance_meters)
    if distance_miles <= 0:
        return "N/A"
        
    pace_seconds_per_mile = moving_time_seconds / distance_miles
    
    # Convert to minutes and seconds
    pace_minutes = int(pace_seconds_per_mile // 60)
    pace_seconds = int(pace_seconds_per_mile % 60)
    
    return f"{pace_minutes}:{pace_seconds:02d}"

def meters_to_miles(meters):
    """Convert meters to miles"""
    if not meters:
        return 0
    return meters * 0.000621371

def format_pace_per_mile(moving_time_seconds, distance_meters):
    """Convert pace to minutes per mile format (MM:SS)"""
    if not distance_meters or distance_meters <= 0 or not moving_time_seconds or moving_time_seconds <= 0:
        return "N/A"
    
    # Convert to miles and calculate pace per mile
    distance_miles = meters_to_miles(distance_meters)
    pace_seconds_per_mile = moving_time_seconds / distance_miles
    
    # Convert to minutes and seconds
    pace_minutes = int(pace_seconds_per_mile // 60)
    pace_seconds = int(pace_seconds_per_mile % 60)
    
    return f"{pace_minutes}:{pace_seconds:02d}"

def store_tokens(athlete_id, access_token, refresh_token):
    connection = create_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = connection.cursor()
    try:
        cursor.execute(
            """
            INSERT INTO users (athlete_id, access_token, refresh_token, created_at, updated_at) 
            VALUES (%s, %s, %s, NOW(), NOW())
            ON DUPLICATE KEY UPDATE 
                access_token = %s,
                refresh_token = %s,
                updated_at = NOW()
            """,
            (athlete_id, access_token, refresh_token, access_token, refresh_token)
        )
        connection.commit()
    except Error as e:
        print(f"Error storing tokens: {e}")
        raise HTTPException(status_code=500, detail="Failed to store tokens")
    finally:
        cursor.close()
        connection.close()
def get_user_tokens(athlete_id):
    connection = create_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = connection.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT access_token, refresh_token FROM users WHERE athlete_id = %s",
            (athlete_id,)
        )
        result = cursor.fetchone()
        return result if result else None
    finally:
        cursor.close()
        connection.close()

def refresh_access_token(refresh_token):
    """Refresh the access token using the refresh token"""
    response = requests.post(
        TOKEN_URL,
        data={
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token"
        }
    )
    
    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Failed to refresh token")
    
    return response.json()

def refresh_and_store_tokens(athlete_id):
    """Refresh Strava tokens and persist the updated credentials."""
    tokens = get_user_tokens(athlete_id)
    if not tokens:
        raise HTTPException(status_code=404, detail="User not found")

    token_info = refresh_access_token(tokens["refresh_token"])
    access_token = token_info["access_token"]
    refresh_token = token_info.get("refresh_token", tokens["refresh_token"])
    store_tokens(athlete_id, access_token, refresh_token)
    return access_token

def parse_strava_datetime(dt_str):
    """Parse Strava ISO timestamps with or without fractional seconds."""
    for fmt in ("%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S.%fZ"):
        try:
            return datetime.strptime(dt_str, fmt)
        except ValueError:
            continue
    raise ValueError(f"Unparseable Strava datetime: {dt_str}")

def _maybe_throttle_strava(response):
    """Respect Strava rate-limit headers before the next request."""
    usage = response.headers.get("X-RateLimit-Usage")
    if not usage:
        return

    try:
        short_term_used, _long_term_used = (int(part) for part in usage.split(","))
    except ValueError:
        return

    limit = response.headers.get("X-RateLimit-Limit")
    if limit:
        try:
            short_term_limit, _long_term_limit = (int(part) for part in limit.split(","))
            if short_term_used >= short_term_limit - STRAVA_RATE_LIMIT_BUFFER:
                reset_at = int(response.headers.get("X-RateLimit-Reset", "0"))
                wait_seconds = max(reset_at - int(time.time()), 30)
                print(f"Strava short-term rate limit near cap ({short_term_used}/{short_term_limit}); sleeping {wait_seconds}s")
                time.sleep(wait_seconds)
                return
        except ValueError:
            pass

    time.sleep(STRAVA_REQUEST_DELAY)

def strava_get_activities(access_token, params, athlete_id=None, retry_on_auth=True):
    """GET athlete activities with rate-limit handling and token refresh."""
    headers = {"Authorization": f"Bearer {access_token}"}
    max_retries = 5

    for attempt in range(max_retries):
        response = requests.get(STRAVA_ACTIVITIES_URL, headers=headers, params=params)

        if response.status_code == 401 and athlete_id and retry_on_auth:
            print(f"Strava token expired for athlete {athlete_id}; refreshing")
            access_token = refresh_and_store_tokens(athlete_id)
            headers = {"Authorization": f"Bearer {access_token}"}
            continue

        if response.status_code == 429:
            retry_after = int(response.headers.get("Retry-After", "60"))
            print(f"Strava rate limit hit; sleeping {retry_after}s (attempt {attempt + 1}/{max_retries})")
            time.sleep(retry_after)
            continue

        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Failed to fetch activities from Strava: {response.text}"
            )

        _maybe_throttle_strava(response)
        return response.json(), access_token

    raise HTTPException(status_code=429, detail="Strava rate limit exceeded after retries")

def get_latest_activity_timestamp(athlete_id):
    """Return Unix timestamp of the athlete's most recent stored activity."""
    connection = create_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")

    cursor = connection.cursor()
    try:
        cursor.execute(
            "SELECT UNIX_TIMESTAMP(MAX(start_date)) FROM activities WHERE athlete_id = %s",
            (athlete_id,)
        )
        row = cursor.fetchone()
        return int(row[0]) if row and row[0] else None
    finally:
        cursor.close()
        connection.close()

def sync_athlete_activities(athlete_id, access_token=None, full_sync=False):
    """
    Paginate through Strava activity history and upsert into the database.
    Uses `after` for incremental syncs when full_sync is False.
    """
    if access_token is None:
        tokens = get_user_tokens(athlete_id)
        if not tokens:
            raise HTTPException(status_code=404, detail="User not found")
        access_token = tokens["access_token"]

    after = None
    if not full_sync:
        after = get_latest_activity_timestamp(athlete_id)
        if after is None:
            full_sync = True

    page = 1
    total_fetched = 0
    total_stored = 0

    print(
        f"Starting {'full' if full_sync else 'incremental'} Strava sync "
        f"for athlete {athlete_id}"
    )

    while True:
        params = {"page": page, "per_page": STRAVA_PER_PAGE}
        if after is not None:
            params["after"] = after

        activities, access_token = strava_get_activities(
            access_token,
            params,
            athlete_id=athlete_id
        )

        if not activities:
            break

        stored = store_activities(activities)
        total_fetched += len(activities)
        total_stored += stored
        print(
            f"Sync page {page}: fetched {len(activities)}, "
            f"stored {stored} (running total {total_fetched})"
        )

        if len(activities) < STRAVA_PER_PAGE:
            break

        page += 1

    result = {
        "athlete_id": athlete_id,
        "sync_type": "full" if full_sync else "incremental",
        "pages_fetched": page,
        "activities_fetched": total_fetched,
        "activities_stored": total_stored,
    }
    print(f"Sync complete for athlete {athlete_id}: {result}")
    return result

def run_background_sync(athlete_id, access_token, full_sync=True):
    """Background task wrapper so OAuth redirect is not blocked by large backfills."""
    try:
        sync_athlete_activities(athlete_id, access_token=access_token, full_sync=full_sync)
    except Exception as e:
        print(f"Background sync failed for athlete {athlete_id}: {e}")

def get_runs_for_athlete(athlete_id, limit=500):
    """Fetch run activities for an athlete, newest first."""
    connection = create_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")

    cursor = connection.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT
                id, name, distance, moving_time, elapsed_time,
                average_heartrate, max_heartrate, total_elevation_gain,
                start_date, type
            FROM activities
            WHERE athlete_id = %s AND type = 'Run'
            ORDER BY start_date DESC
            LIMIT %s
            """,
            (athlete_id, limit),
        )
        return cursor.fetchall()
    except Error as e:
        print(f"Error fetching runs for athlete {athlete_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch training activities")
    finally:
        cursor.close()
        connection.close()

def weekly_summary_input(athlete_id=None):
    connection = create_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")

    cursor = connection.cursor(dictionary=True)
    try:
        if athlete_id:
            cursor.execute(
                """
                SELECT
                    distance, moving_time, average_heartrate, max_heartrate,
                    total_elevation_gain, start_date
                FROM activities
                WHERE athlete_id = %s AND type = 'Run'
                ORDER BY start_date DESC
                LIMIT 365
                """,
                (athlete_id,),
            )
        else:
            cursor.execute(
                """
                SELECT
                    distance, moving_time, average_heartrate, max_heartrate,
                    total_elevation_gain, start_date
                FROM activities
                WHERE type = 'Run'
                ORDER BY start_date DESC
                LIMIT 365
                """
            )
        return cursor.fetchall()
    except Error as e:
        print(f"Error fetching activities: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch weekly activities")
    finally:
        cursor.close()
        connection.close()

def _format_run_line(activity, include_hr=True):
    """Compact one-line summary of a run for LLM context."""
    distance = activity.get("distance", 0) or 0
    moving_time = activity.get("moving_time", 0) or 0
    if distance > 0 and moving_time > 0:
        distance_miles = meters_to_miles(distance)
        pace_str = format_pace_per_mile(moving_time, distance)
    else:
        distance_miles = 0
        pace_str = "N/A"

    start = activity.get("start_date")
    date_str = start.strftime("%Y-%m-%d") if start else "unknown"
    line = (
        f"{date_str}: {distance_miles:.1f}mi, {pace_str}/mi, "
        f"{moving_time / 60:.0f}min"
    )
    if include_hr:
        avg_hr = activity.get("average_heartrate")
        if avg_hr:
            line += f", {avg_hr:.0f}bpm avg"
    return line

def build_fitness_context(athlete_id):
    """
    Build a token-efficient training summary: weekly rollups, aggregates,
    recent runs, and best efforts — instead of dumping hundreds of activities.
    """
    runs = get_runs_for_athlete(athlete_id, limit=500)
    if not runs:
        return "", 0

    min_distance_m = LLM_MIN_RUN_MILES / 0.000621371
    now = datetime.utcnow()
    cutoff_90d = now - timedelta(days=90)

    weekly = defaultdict(lambda: {"miles": 0.0, "runs": 0, "minutes": 0})
    runs_90d = []
    qualifying = []

    for run in runs:
        start = run.get("start_date")
        if not start:
            continue
        distance = run.get("distance", 0) or 0
        moving_time = run.get("moving_time", 0) or 0
        miles = meters_to_miles(distance)

        week_key = start.strftime("%Y-W%W")
        weekly[week_key]["miles"] += miles
        weekly[week_key]["runs"] += 1
        weekly[week_key]["minutes"] += moving_time / 60

        if start >= cutoff_90d:
            runs_90d.append(run)
        if distance >= min_distance_m and moving_time > 0:
            qualifying.append(run)

    week_keys = sorted(weekly.keys(), reverse=True)[:LLM_WEEKLY_WEEKS]
    weekly_lines = [
        f"{wk}: {weekly[wk]['runs']} runs, {weekly[wk]['miles']:.1f}mi, "
        f"{weekly[wk]['minutes']:.0f}min"
        for wk in reversed(week_keys)
    ]

    total_miles_90d = sum(meters_to_miles(r.get("distance", 0) or 0) for r in runs_90d)
    avg_weekly_miles = total_miles_90d / 12 if runs_90d else 0
    longest = max(
        (meters_to_miles(r.get("distance", 0) or 0) for r in runs_90d),
        default=0,
    )

    def pace_key(run):
        d = run.get("distance", 0) or 0
        t = run.get("moving_time", 0) or 0
        if d <= 0 or t <= 0:
            return float("inf")
        return t / meters_to_miles(d)

    best_efforts = sorted(qualifying, key=pace_key)[:LLM_BEST_EFFORTS]
    recent_runs = runs[:LLM_DETAIL_RUNS]

    sections = [
        "TRAINING SUMMARY (miles, min:sec/mi):",
        f"Last 90 days: {len(runs_90d)} runs, {total_miles_90d:.1f} total mi, "
        f"~{avg_weekly_miles:.1f} mi/week avg, longest {longest:.1f}mi",
        "",
        f"WEEKLY VOLUME (last {len(week_keys)} weeks):",
        *weekly_lines,
        "",
        f"RECENT RUNS (last {len(recent_runs)}):",
        *[_format_run_line(r) for r in recent_runs],
    ]

    if best_efforts:
        sections.extend([
            "",
            f"BEST EFFORTS (>{LLM_MIN_RUN_MILES}mi, fastest pace):",
            *[_format_run_line(r) for r in best_efforts],
        ])

    context = "\n".join(sections)
    runs_referenced = len(recent_runs) + len(best_efforts)
    print(
        f"Built fitness context for athlete {athlete_id}: "
        f"{len(runs)} runs in DB, ~{runs_referenced} detailed lines, "
        f"{len(context)} chars"
    )
    return context, len(runs)

def store_activities(activities):
    """Upsert activities into the database."""
    if not activities:
        return 0

    connection = create_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")

    cursor = connection.cursor()
    stored_count = 0
    insert_query = """
    INSERT INTO activities (
        id, name, distance, moving_time, elapsed_time,
        total_elevation_gain, type, start_date, start_date_local,
        timezone, average_speed, max_speed, average_cadence,
        average_heartrate, max_heartrate, calories, athlete_id
    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        distance = VALUES(distance),
        moving_time = VALUES(moving_time),
        elapsed_time = VALUES(elapsed_time),
        total_elevation_gain = VALUES(total_elevation_gain),
        type = VALUES(type),
        start_date = VALUES(start_date),
        start_date_local = VALUES(start_date_local),
        timezone = VALUES(timezone),
        average_speed = VALUES(average_speed),
        max_speed = VALUES(max_speed),
        average_cadence = VALUES(average_cadence),
        average_heartrate = VALUES(average_heartrate),
        max_heartrate = VALUES(max_heartrate),
        calories = VALUES(calories),
        athlete_id = VALUES(athlete_id)
    """

    try:
        for activity in activities:
            start_date = parse_strava_datetime(activity["start_date"])
            start_date_local = parse_strava_datetime(activity["start_date_local"])
            athlete_id = activity["athlete"]["id"]

            data = (
                activity["id"],
                activity["name"],
                activity["distance"],
                activity["moving_time"],
                activity["elapsed_time"],
                activity["total_elevation_gain"],
                activity["type"],
                start_date,
                start_date_local,
                activity["timezone"],
                activity["average_speed"],
                activity["max_speed"],
                activity.get("average_cadence"),
                activity.get("average_heartrate"),
                activity.get("max_heartrate"),
                activity.get("calories"),
                athlete_id,
            )

            cursor.execute(insert_query, data)
            stored_count += 1

        connection.commit()
        return stored_count
    except Exception as e:
        print(f"Error storing activities: {e}")
        connection.rollback()
        raise HTTPException(status_code=500, detail="Failed to store activities")
    finally:
        cursor.close()
        connection.close()
##Endpoints: 
@app.get("/")
async def root():
    return {"message": "Welcome to the StrideSmart API"}

@app.get("/login")
def login():
    authorization_url = (
        f"{AUTHORIZATION_URL}?client_id={CLIENT_ID}&response_type=code"
        f"&redirect_uri={REDIRECT_URI}&scope=activity:read_all"
    )
    print(f"Redirecting to Strava: {authorization_url}")  # Debug log
    return RedirectResponse(url=authorization_url)


@app.get("/oauth2/callback")
async def oauth2_callback(background_tasks: BackgroundTasks, code: str = Query(None)):
    if code:
        print(f"Authorization code received: {code}")
        
        # Step 1: Exchange the code for an access token
        response = requests.post(
            TOKEN_URL,
            data={
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": REDIRECT_URI
            },
        )

        # Step 2: Check if the token exchange was successful
        if response.status_code == 200:
            token_info = response.json()
            access_token = token_info.get("access_token")
            refresh_token = token_info.get("refresh_token")
            athlete_id = token_info["athlete"]["id"]

            print(f"Tokens received for athlete {athlete_id}")

            # Step 3: Store tokens and proceed
            try:
                store_tokens(athlete_id, access_token, refresh_token)
                print(f"Tokens successfully stored for athlete {athlete_id}")
            except Exception as e:
                print(f"Error storing tokens: {e}")
                raise HTTPException(status_code=500, detail="Failed to store tokens")
            
            # Step 4: Backfill activity history in the background so OAuth redirect stays fast
            background_tasks.add_task(run_background_sync, athlete_id, access_token, True)
            print(f"Queued full Strava history sync for athlete {athlete_id}")

            # Redirect to frontend with success parameter and athlete_id
            return RedirectResponse(url=f"{FRONTEND_URL}/dashboard?success=true&athlete_id={athlete_id}")
        else:
            print(f"Failed to obtain access token: {response.text}")
            raise HTTPException(status_code=response.status_code, detail="Failed to obtain access token")
    else:
        print("No authorization code received")
        return {"error": "Authorization code missing"}

@app.post("/sync")
async def sync_activities(athlete_id: int, full: bool = Query(False)):
    """
    Sync activities from Strava for an athlete.
    Defaults to incremental sync; pass full=true to backfill entire history.
    """
    try:
        return sync_athlete_activities(athlete_id, full_sync=full)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error syncing activities for athlete {athlete_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to sync activities")

@app.get("/training")
async def get_stored_activities(athlete_id: int):
    """Retrieve stored activities from the database for a specific athlete"""
    connection = create_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = connection.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM activities WHERE athlete_id = %s ORDER BY start_date DESC", (athlete_id,))
        activities = cursor.fetchall()
        print(f"Retrieved {len(activities)} activities for athlete {athlete_id}")
        if activities:
            print(f"Sample activity: {activities[0]}")  # Print the first activity as a sample
        else:
            print("No activities found for this athlete")
        return activities
    finally:
        cursor.close()
        connection.close()

@app.get("/activities/weeklysummary")
async def return_weekly_data(athlete_id: int = Query(None)):
    return weekly_summary_input(athlete_id)

@app.post("/llm/analyze")
async def analyze_activities(request: Request):
    try:
        data = await request.json()
        race_date = data.get("raceDate")
        desired_time = data.get("desiredTime")
        race_type = data.get("raceType", "Marathon")
        athlete_id = data.get("athlete_id")

        print(
            f"Analysis request athlete={athlete_id} race={race_type} "
            f"date={race_date} goal={desired_time}"
        )

        if not athlete_id:
            raise HTTPException(
                status_code=400,
                detail="athlete_id is required for training analysis",
            )

        fitness_context, total_runs = build_fitness_context(athlete_id)

        if not fitness_context:
            return {
                "analysis": "No training data available. Please sync your Strava activities first.",
                "training_data_used": 0,
                "status": "no_data",
            }

        prompt = f"""Analyze this athlete's training for {race_type} preparation.

GOALS:
- Race: {race_type} on {race_date}
- Goal time: {desired_time}

{fitness_context}

Use ONLY miles and min:sec per mile for paces. Do NOT use kilometers.

RESPONSE FORMAT:
1. Current Fitness Assessment (3-4 sentences)
2. Projected Race Time: "Based on your recent training, I project a finish time of X:XX:XX"
3. Training Recommendations (3-4 specific points with paces)
4. Weekly Training Structure recommendation

Prioritize best efforts and quality sessions over easy runs for race projections."""

        print(f"Sending analysis to OpenAI (max_tokens={LLM_ANALYZE_MAX_TOKENS})...")

        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an experienced running coach. Use miles and min:sec per mile only. "
                        "Be concise and actionable."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            max_tokens=LLM_ANALYZE_MAX_TOKENS,
            temperature=0.7,
        )

        analysis = response.choices[0].message.content
        print("Successfully received OpenAI response")

        return {
            "analysis": analysis,
            "training_data_used": total_runs,
            "status": "success",
        }
        
    except Exception as e:
        print(f"Error in analyze_activities: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        
        # More specific error handling
        if "api_key" in str(e).lower():
            error_detail = "OpenAI API key is missing or invalid"
        elif "rate_limit" in str(e).lower():
            error_detail = "OpenAI API rate limit exceeded"
        elif "insufficient_quota" in str(e).lower():
            error_detail = "OpenAI API quota exceeded"
        else:
            error_detail = f"Failed to analyze training data: {str(e)}"
        
        raise HTTPException(
            status_code=500,
            detail=error_detail
        )

# Endpoint for chatbot functionality
@app.post("/llm/chat")
async def chat_with_coach(request: Request):
    try:
        data = await request.json()
        message = data.get("message", "")
        athlete_id = data.get("athlete_id")
        
        if not message:
            raise HTTPException(status_code=400, detail="Message is required")
        
        print(f"Chat request from athlete {athlete_id}: {message[:100]}...")
        
        training_context = ""
        if athlete_id:
            fitness_context, _total_runs = build_fitness_context(athlete_id)
            if fitness_context:
                training_context = (
                    f"\n\nAthlete training data (miles, min:sec/mi):\n{fitness_context}"
                )

        system_prompt = f"""You are an experienced running coach chatting with an athlete.
Use miles and min:sec per mile only — never kilometers.
Keep responses concise and conversational.{training_context}"""

        print(f"Sending chat to OpenAI (max_tokens={LLM_CHAT_MAX_TOKENS})...")

        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": message},
            ],
            max_tokens=LLM_CHAT_MAX_TOKENS,
            temperature=0.7,
        )
        
        reply = response.choices[0].message.content
        
        return {
            "reply": reply,
            "status": "success"
        }
        
    except Exception as e:
        print(f"Error in chat endpoint: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process chat message: {str(e)}"
        )
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=os.getenv('SERVER_HOST', '127.0.0.1'), port=os.getenv('SERVER_PORT', 8000), reload=True)

#fastapi dev .venv/main.py
#fastapi dev main.py
# uvicorn main:app --reload
#uvicorn .venv/main.py:app --reload
