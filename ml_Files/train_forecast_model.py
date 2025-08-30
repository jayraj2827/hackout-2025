# scripts/train_forecast_model_dynamic.py
import pandas as pd
import numpy as np
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense
import os

# -------------------------------
# Base paths
# -------------------------------
BASE_DIR = os.path.join(os.getcwd(), "ml_Files")
DATA_DIR = os.path.join(BASE_DIR, "data")
MODEL_DIR = os.path.join(BASE_DIR, "models")
os.makedirs(MODEL_DIR, exist_ok=True)

PREPROCESSED_FILE = os.path.join(DATA_DIR, "preprocessed_data.csv")
FORECAST_MODEL_FILE = os.path.join(MODEL_DIR, "forecast_model.h5")

# -------------------------------
# Functions
# -------------------------------
def create_sequences(data, seq_length=7):
    X, y = [], []
    for i in range(len(data) - seq_length):
        X.append(data[i:i+seq_length])
        y.append(data[i+seq_length,0])  # tide
    return np.array(X), np.array(y)

def train():
    # Load preprocessed data
    df = pd.read_csv(PREPROCESSED_FILE)
    station = 'Chennai'  # Can loop over stations if needed
    df_station = df[df['station']==station].sort_values('timestamp')
    features = ['tide','rainfall','temperature','wind_speed']
    data = df_station[features].values

    X, y = create_sequences(data)
    
    # LSTM model
    model = Sequential()
    model.add(LSTM(50, input_shape=(X.shape[1], X.shape[2])))
    model.add(Dense(1))
    model.compile(optimizer='adam', loss='mse')
    
    model.fit(X, y, epochs=20, batch_size=16, validation_split=0.1)
    model.save(FORECAST_MODEL_FILE)
    print(f"Forecast model for {station} trained and saved to {FORECAST_MODEL_FILE}")

if __name__ == "__main__":
    train()
