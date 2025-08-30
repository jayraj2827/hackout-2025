# scripts/generate_dataset.py
import pandas as pd
import numpy as np
import os

# Base folder for ML files
BASE_DIR = os.path.join(os.getcwd(), "ml_Files")
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

LOG_FILE = os.path.join(BASE_DIR, "live_data_log.csv")
HIST_FILE = os.path.join(BASE_DIR, "preprocessed_data.csv")
SIMULATED_DATA_FILE = os.path.join(DATA_DIR, "simulated_coastal_multi_sensors.csv")

def generate_dataset(start_date="2015-01-01", end_date="2024-12-31", freq='D', stations=None, seed=42):
    """
    Generate a synthetic coastal sensor dataset for multiple stations.
    """
    np.random.seed(seed)
    
    if stations is None:
        stations = [
            {'name': 'Chennai', 'lat': 13.08, 'lon': 80.27},
            {'name': 'Mumbai', 'lat': 18.96, 'lon': 72.82},
            {'name': 'Sundarbans', 'lat': 21.95, 'lon': 88.69},
            {'name': 'Kolkata', 'lat': 22.57, 'lon': 88.36},
            {'name': 'Goa', 'lat': 15.49, 'lon': 73.83},
            {'name': 'Visakhapatnam', 'lat': 17.68, 'lon': 83.22},
            {'name': 'Puri', 'lat': 19.81, 'lon': 85.82}
        ]
    
    timestamps = pd.date_range(start=start_date, end=end_date, freq=freq)
    n = len(timestamps)
    data = []

    for station in stations:
        idx = np.arange(n)
        
        # Simulate seasonal patterns and random noise
        tide = 2 + 1.5*np.sin(2*np.pi*idx/365) + np.random.normal(0,0.2,n)
        rainfall = np.clip(np.random.normal(5,2,n) + 5*np.sin(2*np.pi*idx/365 - np.pi/2), 0, None)
        temperature = 28 + 5*np.sin(2*np.pi*idx/365) + np.random.normal(0,1,n)
        wind_speed = np.clip(10 + 5*np.sin(2*np.pi*idx/180) + np.random.normal(0,2,n), 0, None)
        wind_direction = np.random.uniform(0,360,n)
        ndvi = np.clip(0.5 + 0.3*np.sin(2*np.pi*idx/365) + np.random.normal(0,0.05,n), 0, 1)
        chlorophyll = np.clip(1 + 0.5*np.sin(2*np.pi*idx/90) + np.random.normal(0,0.2,n), 0, None)
        cyclone = np.random.choice([0,1], size=n, p=[0.97,0.03])
        flood = np.random.choice([0,1], size=n, p=[0.95,0.05])

        # Correlations: tide spikes if cyclone or flood
        tide += 0.5 * cyclone + 0.3 * flood
        rainfall += 10 * flood

        # Occasionally missing sensor data
        for col_name, col_data in zip(
            ['tide','rainfall','temperature','wind_speed','ndvi','chlorophyll'],
            [tide,rainfall,temperature,wind_speed,ndvi,chlorophyll]
        ):
            nan_mask = np.random.rand(n) < 0.01  # 1% missing
            col_data[nan_mask] = np.nan

        df_station = pd.DataFrame({
            'timestamp': timestamps,
            'station': station['name'],
            'latitude': station['lat'],
            'longitude': station['lon'],
            'tide': tide,
            'rainfall': rainfall,
            'temperature': temperature,
            'wind_speed': wind_speed,
            'wind_direction': wind_direction,
            'ndvi': ndvi,
            'chlorophyll': chlorophyll,
            'cyclone': cyclone,
            'flood': flood
        })
        
        data.append(df_station)

    df_all = pd.concat(data, ignore_index=True)

    df_all.to_csv(SIMULATED_DATA_FILE, index=False)
    
    print(f"Dataset generated at {SIMULATED_DATA_FILE} with {len(stations)} stations and {n} days each!")

if __name__ == "__main__":
    generate_dataset()
