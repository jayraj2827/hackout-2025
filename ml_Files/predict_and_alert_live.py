# scripts/predict_and_alert_live.py
import requests
import pandas as pd
import numpy as np
from datetime import datetime
from tensorflow.keras.models import load_model
import pickle
import random
import time
import json
import ollama
from groq import Groq
import os
import glob
import google.generativeai as genai
from dotenv  import load_dotenv
load_dotenv()
# -------------------------------
# Base paths
# -------------------------------
BASE_DIR = os.path.join(os.getcwd(), "ml_Files")
DATA_DIR = os.path.join(BASE_DIR, "data")
MODEL_DIR = os.path.join(BASE_DIR, "models")
ANOMALY_MODEL_DIR = os.path.join(MODEL_DIR, "anomaly_models")

os.makedirs(DATA_DIR, exist_ok=True)

LOG_FILE = os.path.join(DATA_DIR, "live_data_log.csv")
HIST_FILE = os.path.join(DATA_DIR, "preprocessed_data.csv")

client = Groq(
    api_key=os.getenv("GROQ_API_KEY")
)
# -------------------------------
# Configuration
# -------------------------------
API_KEY_WEATHER = os.getenv("API_KEY_WEATHER")
STATIONS = {
    "Chennai": "Chennai,IN",
    "Mumbai": "Mumbai,IN",
    "Kolkata": "Kolkata,IN",
    "Visakhapatnam": "Visakhapatnam,IN",
    "Puri": "Puri,IN",
    "Goa": "Goa,IN"
}

SYSTEM_PROMPT = f"You are a smart sumarizer agent who sumarize the json data of the 5-6 cities in 2 lines only mentioned now youhave to sumarize smartly then tell me that which resgion is at high risk  ,dont act like a 4rd agent act like you are  analyzing and in Human response [Strictly Dont sumarize detail in more than 2 lines].Current time: {time.time()}"
ALERT_TIDE = 3.5
ALERT_EVENT_PROB = 0.5
SEQ_LENGTH = 7
ROLLING_WINDOW = 3

# -------------------------------
# Load Models
# -------------------------------
forecast_model = load_model(os.path.join(MODEL_DIR, "forecast_model.h5"), compile=False)
event_model = pickle.load(open(os.path.join(MODEL_DIR, "event_model.pkl"), "rb"))

# Load per-station anomaly models
ANOMALY_MODELS = {}
for file in glob.glob(os.path.join(ANOMALY_MODEL_DIR, "*.pkl")):
    station_name = os.path.basename(file).split("_")[0]
    ANOMALY_MODELS[station_name] = pickle.load(open(file, "rb"))
print("Loaded anomaly models for stations:", list(ANOMALY_MODELS.keys()))


# -------------------------------
# Functions
# -------------------------------
def fetch_weather(city_code):
    try:
        url = f"http://api.openweathermap.org/data/2.5/weather?q={city_code}&appid={API_KEY_WEATHER}&units=metric"
        response = requests.get(url).json()
        temp = float(response['main']['temp'])
        wind = float(response['wind']['speed'])
        rainfall = float(response.get('rain', {}).get('1h', 0))
        return temp, wind, rainfall
    except Exception as e:
        print(f"[ERROR] Weather API failed for {city_code}: {e}")
        return np.nan, np.nan, np.nan

def simulate_satellite_features():
    ndvi = round(random.uniform(0.4, 0.6), 2)
    chlorophyll = round(random.uniform(1, 5), 2)
    return ndvi, chlorophyll

def generate_insight_ollama(alerts_json):
    try:
        prompt_text = SYSTEM_PROMPT.format(datetime.now()) + "\n\n" + json.dumps(alerts_json, indent=2)
        chat_completion = client.chat.completions.create(
        messages=[
            {
                "role": "user",
                "content": prompt_text,
            }
        ],
        model="llama-3.1-8b-instant",
        stream=False,
        )

        return chat_completion.choices[0].message.content


    except Exception as e:
        print("Ollama LLM Failed:", e)
        return "LLM summary unavailable."


def run_live_alert():
    live_records = []
    output_json = []

    df_hist = pd.read_csv(HIST_FILE) if os.path.exists(HIST_FILE) else pd.DataFrame()

    for station_name, city_code in STATIONS.items():
        timestamp = datetime.now()
        temp, wind, rainfall = fetch_weather(city_code)
        ndvi, chlorophyll = simulate_satellite_features()

        df_live = pd.DataFrame([{
            'timestamp': timestamp,
            'station': station_name,
            'temperature': temp,
            'wind_speed': wind,
            'rainfall': rainfall,
            'ndvi': ndvi,
            'chlorophyll': chlorophyll,
            'tide': round(random.uniform(0.3, 1.0), 2)
        }])
        live_records.append(df_live)

        # Forecast tide
        try:
            df_station_hist = df_hist[df_hist['station'] == station_name].sort_values('timestamp').tail(SEQ_LENGTH-1)
            if len(df_station_hist) < SEQ_LENGTH-1:
                raise ValueError("Not enough historical data for LSTM forecast.")
            features = ['tide','rainfall','temperature','wind_speed']
            df_input = pd.concat([df_station_hist[features], df_live[features]], ignore_index=True)
            X_input = df_input.values.reshape((1, SEQ_LENGTH, len(features)))
            pred_tide = float(forecast_model.predict(X_input)[0][0])
            alert_tide = pred_tide > ALERT_TIDE
            last_tide = df_station_hist['tide'].iloc[-1] if len(df_station_hist) >= 1 else pred_tide
            tide_trend = "rising" if pred_tide > last_tide + 0.05 else "falling" if pred_tide < last_tide - 0.05 else "stable"
        except Exception as e:
            pred_tide = np.nan
            alert_tide = False
            tide_trend = "stable"
            print(f"[{station_name}] Forecast error: {e}")

        # Anomaly detection
        try:
            anomaly_model = ANOMALY_MODELS[station_name]
            df_recent = pd.concat([df_station_hist.tail(ROLLING_WINDOW-1), df_live])
            anomaly = anomaly_model.predict(df_recent[features + ['ndvi','chlorophyll']])
            alert_anomaly = anomaly[-1] == -1
        except:
            alert_anomaly = False

        # Event prediction
        try:
            prob = float(event_model.predict_proba(df_live[features + ['ndvi','chlorophyll']])[:,1][0])
            alert_event = prob > ALERT_EVENT_PROB
        except:
            prob = np.nan
            alert_event = False

        # Critical alert
        risk_score = int(alert_tide) + int(alert_anomaly) + int(alert_event)
        critical_alert = risk_score >= 2

        df_station_hist_full = df_hist[df_hist['station'] == station_name]
        latitude = df_station_hist_full['latitude'].iloc[0] if not df_station_hist_full.empty else None
        longitude = df_station_hist_full['longitude'].iloc[0] if not df_station_hist_full.empty else None

        # station_output = {
        #     "timestamp": str(timestamp),
        #     "station": station_name,
        #     "latitude": latitude,
        #     "longitude": longitude,
        #     "temperature": temp,
        #     "wind_speed": wind,
        #     "rainfall": rainfall,
        #     "tide": pred_tide,
        #     "tide_trend": tide_trend,
        #     "ndvi": ndvi,
        #     "chlorophyll": chlorophyll,
        #     "alerts": {
        #         "high_tide": alert_tide,
        #         "anomaly": alert_anomaly,
        #         "event": alert_event,
        #         "event_probability": prob,
        #         "critical_alert": critical_alert
        #     }
        # }
        station_output = {
    "timestamp": str(timestamp),
    "station": station_name,
    "latitude": latitude,
    "longitude": longitude,
    "temperature": temp,
    "wind_speed": wind,
    "rainfall": rainfall,
    "tide": float(pred_tide) if not np.isnan(pred_tide) else None,
    "tide_trend": tide_trend,
    "ndvi": ndvi,
    "chlorophyll": chlorophyll,
    "alerts": {
        "high_tide": bool(alert_tide),
        "anomaly": bool(alert_anomaly),
        "event": bool(alert_event),
        "event_probability": float(prob) if not np.isnan(prob) else None,
        "critical_alert": bool(critical_alert)
    }
}

        output_json.append(station_output)

    # Log live data
    df_all_live = pd.concat(live_records, ignore_index=True)
    df_all_live.to_csv(LOG_FILE, mode='a', index=False, header=not os.path.exists(LOG_FILE))
    
    llm_summary = generate_insight_ollama(output_json)
    
    return {
        "alerts": output_json,
        "llm_summary": llm_summary
    }

# -------------------------------
# Run once for testing
# -------------------------------
if __name__ == "__main__":
    output = run_live_alert()
    print(json.dumps(output, indent=2))
