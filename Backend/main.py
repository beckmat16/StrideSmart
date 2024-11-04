from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.responses import RedirectResponse
import requests
import mysql.connector
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import openai
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
openai.api_key=os.getenv('OPENAI_API_KEY')

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

def fetch_last_30_activities(access_token):
    """Fetch the last 30 activities from Strava"""
    url = "https://www.strava.com/api/v3/athlete/activities"
    headers = {"Authorization": f"Bearer {access_token}"}
    params = {"per_page": 30}
    
    response = requests.get(url, headers=headers, params=params)
    
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail="Failed to fetch activities")
    
    return response.json()

def weekly_summary_input():
    connection = create_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = connection.cursor(dictionary=True)
    try: 
        cursor.execute(
            """
            SELECT 
                distance,
                moving_time,
                average_heartrate,
                max_heartrate,
                total_elevation_gain,
                start_date
            FROM activities 
            ORDER BY start_date DESC 
            LIMIT 10
            """
        )
        activities = cursor.fetchall()
        return activities
    except Error as e:
        print(f"Error fetching activities: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch weekly activities")
    finally:
        cursor.close()
        connection.close()

def get_existing_activity_ids(athlete_id):
    connection = create_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = connection.cursor()
    try:
        cursor.execute(
            "SELECT id FROM activities WHERE athlete_id = %s",
            (athlete_id,)
        )
        ids = [row[0] for row in cursor.fetchall()]
        print(f"Fetched {len(ids)} existing activity IDs for athlete {athlete_id}")
        print(f"Sample of existing IDs: {ids[:5]}")  # Print first 5 IDs as a sample
        return ids
    finally:
        cursor.close()
        connection.close()

def store_new_activities(activities, existing_ids):
    """Store new activities in the database"""
    connection = create_connection()
    if not connection:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = connection.cursor()
    try:
        new_activities_count = 0
        for activity in activities:
            if activity["id"] not in existing_ids:
                # Convert timestamps
                start_date = datetime.strptime(activity["start_date"], '%Y-%m-%dT%H:%M:%SZ')
                start_date_local = datetime.strptime(activity["start_date_local"], '%Y-%m-%dT%H:%M:%SZ')

                athlete_id = activity["athlete"]["id"]

                # Define the data tuple to be inserted
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
                
                print(f"Inserting new activity: {activity['id']} for athlete {athlete_id}")
                cursor.execute(insert_query, data)
                new_activities_count += 1
            else:
                print(f"Activity {activity['id']} already exists, skipping")
        
        connection.commit()
        print(f"Successfully stored {new_activities_count} new activities")
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
async def oauth2_callback(request: Request, code: str = Query(None)):
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
            
            # Step 4: Fetch and store the last 30 activities
            try:
                recent_activities = fetch_last_30_activities(access_token)
                print(f"Fetched {len(recent_activities)} activities")
                existing_ids = get_existing_activity_ids(athlete_id)
                print(f"Existing Activity IDs: {existing_ids}")
                store_new_activities(recent_activities, existing_ids)
                print(f"Activities successfully stored for athlete {athlete_id}")
            except Exception as e:
                print(f"Error processing authentication: {e}")
                raise HTTPException(status_code=500, detail="Failed to process authentication")

            # Redirect to frontend with success parameter and athlete_id
            return RedirectResponse(url=f"{FRONTEND_URL}/dashboard?success=true&athlete_id={athlete_id}")
        else:
            print(f"Failed to obtain access token: {response.text}")
            raise HTTPException(status_code=response.status_code, detail="Failed to obtain access token")
    else:
        print("No authorization code received")
        return {"error": "Authorization code missing"}

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
async def return_weekly_data():
    return weekly_summary_input()

@app.post("/llm/analyze")
async def analyze_activities(request: Request):
    # Parse incoming JSON data from frontend
    data = await request.json()
    race_date = data.get("raceDate")
    desired_time = data.get("desiredTime")
    
    # Get training data from database
    training_data = weekly_summary_input()
    
    # Format the training data into a readable string
    formatted_activities = []
    for activity in training_data:
        # Calculate pace (min/km)
        pace_seconds = activity['moving_time'] / (activity['distance'] / 1000)
        pace_minutes = pace_seconds / 60
        pace_min = int(pace_minutes)
        pace_sec = int((pace_minutes - pace_min) * 60)
        
        activity_str = (
            f"Date: {activity['start_date'].strftime('%Y-%m-%d')}\n"
            f"Distance: {activity['distance']/1000:.2f} km\n"
            f"Duration: {activity['moving_time']/60:.0f} minutes\n"
            f"Pace: {pace_min}:{pace_sec:02d} min/km\n"
            f"Average Heart Rate: {activity['average_heartrate']:.0f} bpm\n"
            f"Max Heart Rate: {activity['max_heartrate']:.0f} bpm\n"
            f"Elevation Gain: {activity['total_elevation_gain']:.0f} meters\n"
            "---"
        )
        formatted_activities.append(activity_str)
    
    activities_summary = "\n".join(formatted_activities)
    
    prompt = f"""As a running coach, analyze this athlete's training data and provide recommendations.

Recent Training Activities:
{activities_summary}

Race Goals:
- Target Race Date: {race_date}
- Desired Race Time: {desired_time}

Please provide:
1. Current Fitness Assessment based on:
   - Recent training paces
   - Heart rate zones and cardiovascular fitness
   - Training volume (distance and time)
   - Elevation training
2. Projected Race Time based on recent training data
3. Specific workout recommendations for next week
4. Areas for improvement and training adjustments

Consider the relationship between heart rate and pace, training volume progression, and intensity distribution in your analysis.
"""

    try:
        response = openai.chat.completions.create(
            model="gpt-4",
            messages=[
                {
                    "role": "system",
                    "content": "You are an experienced running coach who analyzes training data and provides detailed, actionable feedback and recommendations."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            max_tokens=1000,
            temperature=0.7
        )
        
        analysis = response.choices[0].message.content
        
        return {
            "analysis": analysis,
            "training_data_used": len(training_data),
            "status": "success"
        }
        
    except Exception as e:
        print(f"Error calling OpenAI API: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to analyze training data"
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=os.getenv('SERVER_HOST', '127.0.0.1'), port=os.getenv('SERVER_PORT', 8000), reload=True)

#fastapi dev .venv/main.py
#fastapi dev main.py
# uvicorn main:app --reload
#uvicorn .venv/main.py:app --reload
