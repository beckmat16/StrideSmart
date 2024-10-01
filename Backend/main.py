from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import RedirectResponse
import requests
import mysql.connector
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

##My Strava Data
CLIENT_ID = "132274"
CLIENT_SECRET = "874eff85ee2e7337c18b91c7efada854f865c078"
AUTHORIZATION_URL = "https://www.strava.com/oauth/authorize"
TOKEN_URL = "https://www.strava.com/oauth/token"
REDIRECT_URI = "http://127.0.0.1:8000/oauth2/callback"
ACCESS_TOKEN = None

##Any other variables
json_data= ""

##Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this to your domain or use "*" for all
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

##Setting up my MySQL Connection
def create_connection():
    try:
        connection = mysql.connector.connect(
            host='localhost',
            database='stravadata',
            user='root',
            password='410220920Hh!'
        )
        if connection.is_connected():
            return connection
    except Error as e:
        return None

##Create endpoint for SQL data
@app.get("/training")
def get_stored_activities():
    connection = create_connection()
    cursor = connection.cursor(dictionary=True)
    
    cursor.execute("SELECT * FROM activities")
    activities = cursor.fetchall()
    
    cursor.close()
    connection.close()
    return activities


##Workflow 1 -Log in and redirect to authorization page from strava
@app.get("/login")
def login():
    authorization_url = (
        f"{AUTHORIZATION_URL}?client_id={CLIENT_ID}&response_type=code"
        f"&redirect_uri={REDIRECT_URI}&scope=activity:read"
    )
    return RedirectResponse(url=authorization_url)

##Workflow 2 - Obtain access token
@app.get("/oauth2/callback")
def oauth2_callback(code: str):
    global ACCESS_TOKEN
    response = requests.post(
        TOKEN_URL,
        data={
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": REDIRECT_URI,
        },
    )
    
    if response.status_code == 200:
        token_info = response.json()
        ACCESS_TOKEN = token_info["access_token"]
        return {"access_token": ACCESS_TOKEN}
    else:
        raise HTTPException(status_code=response.status_code, detail="Failed to obtain access token")

##Workflow 3 - fetch data from the activity
@app.get("/activities/{id}")
def get_activity(id: int, include_all_efforts: bool = False):
    if not ACCESS_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized: Access token is missing")
    
    url = f"https://www.strava.com/api/v3/activities/{id}"
    headers = {
        "Authorization": f"Bearer {ACCESS_TOKEN}"
    }
    params = {
        "include_all_efforts": include_all_efforts
    }
    response = requests.get(url, headers=headers, params=params)
    
    if response.status_code == 200:
        json_data = response.json()
        # Extract relevant fields from JSON
        id = json_data["id"]
        name = json_data["name"]
        distance = json_data["distance"]
        moving_time = json_data["moving_time"]
        elapsed_time = json_data["elapsed_time"]
        total_elevation_gain = json_data["total_elevation_gain"]
        type = json_data["type"]
        start_date = datetime.strptime(json_data["start_date"], '%Y-%m-%dT%H:%M:%SZ')
        start_date_local = datetime.strptime(json_data["start_date_local"], '%Y-%m-%dT%H:%M:%SZ')
        timezone = json_data["timezone"]
        location_country = json_data["location_country"]
        average_speed = json_data["average_speed"]
        max_speed = json_data["max_speed"]
        average_cadence = json_data.get("average_cadence", None)
        average_heartrate = json_data.get("average_heartrate", None)
        max_heartrate = json_data.get("max_heartrate", None)
        calories = json_data.get("calories", None)
        trainer = json_data["trainer"]
        commute = json_data["commute"]
        manual = json_data["manual"]
        private = json_data["private"]

        # Move fields to SQL/create connection
        connection = create_connection()
        cursor = connection.cursor()
        
        # SQL INSERT statement
        insert_query = """
        INSERT INTO activities (id, name, distance, moving_time, elapsed_time, 
                                total_elevation_gain, type, start_date, 
                                start_date_local, timezone, location_country, 
                                average_speed, max_speed, average_cadence, 
                                average_heartrate, max_heartrate, calories, 
                                trainer, commute, manual, private) 
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,%s)
        """
        data_to_insert = (id, name, distance, moving_time, 
                      elapsed_time, total_elevation_gain, type, 
                      start_date, start_date_local, timezone, 
                      location_country, average_speed, max_speed, 
                      average_cadence, average_heartrate, 
                      max_heartrate, calories, trainer, commute, 
                      manual, private)
        
        cursor.execute(insert_query, data_to_insert)
        connection.commit()  # Commit the transaction
        print("Data inserted successfully")

        # Close the cursor and connection
        cursor.close()
        connection.close()
        return response.json()
    
    else:
        raise HTTPException(status_code=response.status_code, detail=response.text)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=True)

#fastapi dev .venv/main.py
#fastapi dev main.py
# uvicorn main:app --reload
#uvicorn .venv/main.py:app --reload
#strava client: 874eff85ee2e7337c18b91c7efada854f865c078
#strava_access_token: 0db1d46556e992a133b159a6d486ff163d9e580a
#strava_refresh_token: aa58ba8435b5792fbe62c2701edc3ef24be97251
#https://www.strava.com/oauth/authorize?client_id=132274&redirect_uri=http://localhost&response_type=code&scope=activity:read_all