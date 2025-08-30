# scripts/preprocess_data.py
import pandas as pd
from sklearn.preprocessing import MinMaxScaler
import pickle
import os

# -------------------------------
# Base paths
# -------------------------------
BASE_DIR = os.path.join(os.getcwd(), "ml_Files")
DATA_DIR = os.path.join(BASE_DIR, "data")
MODEL_DIR = os.path.join(BASE_DIR, "models")
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(MODEL_DIR, exist_ok=True)

RAW_FILE = os.path.join(DATA_DIR, "simulated_coastal_multi_sensors.csv")
PREPROCESSED_FILE = os.path.join(DATA_DIR, "preprocessed_data.csv")
SCALER_FILE = os.path.join(MODEL_DIR, "scaler.pkl")

def preprocess():
    # Load raw data
    df = pd.read_csv(RAW_FILE)

    # Sort by station and timestamp to maintain chronological order
    df.sort_values(['station', 'timestamp'], inplace=True)
    
    # Fill missing values if any
    df.fillna(method='ffill', inplace=True)
    
    # Define features to scale
    features = ['tide', 'rainfall', 'temperature', 'wind_speed', 
                'wind_direction', 'ndvi', 'chlorophyll']
    
    # Initialize and fit scaler
    scaler = MinMaxScaler()
    df[features] = scaler.fit_transform(df[features])
    
    # Save preprocessed data
    df.to_csv(PREPROCESSED_FILE, index=False)
    
    # Save the scaler for live predictions
    pickle.dump(scaler, open(SCALER_FILE, "wb"))
    
    print(f"Preprocessing done! Saved to {PREPROCESSED_FILE} and scaler to {SCALER_FILE}")

if __name__ == "__main__":
    preprocess()
