# scripts/train_anomaly_model_dynamic.py
import pandas as pd
from sklearn.ensemble import IsolationForest
import pickle
import os

# -------------------------------
# Base paths
# -------------------------------
BASE_DIR = os.path.join(os.getcwd(), "ml_Files")
DATA_DIR = os.path.join(BASE_DIR, "data")
MODEL_DIR = os.path.join(BASE_DIR, "models", "anomaly_models")
os.makedirs(MODEL_DIR, exist_ok=True)

PREPROCESSED_FILE = os.path.join(DATA_DIR, "preprocessed_data.csv")

def train_all_stations():
    # Load preprocessed data
    df = pd.read_csv(PREPROCESSED_FILE)
    features = ['tide','rainfall','temperature','wind_speed','ndvi','chlorophyll']
    
    stations = df['station'].unique()
    
    for station in stations:
        df_station = df[df['station'] == station]
        
        iso = IsolationForest(contamination=0.01, random_state=42)
        iso.fit(df_station[features])
        
        model_path = os.path.join(MODEL_DIR, f"{station}_anomaly_model.pkl")
        pickle.dump(iso, open(model_path, "wb"))
        print(f"[{station}] Anomaly model trained and saved to {model_path}")

if __name__ == "__main__":
    train_all_stations()
