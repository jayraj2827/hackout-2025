# scripts/train_event_model_dynamic.py
import pandas as pd
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier
import pickle
import os

# -------------------------------
# Base paths
# -------------------------------
BASE_DIR = os.path.join(os.getcwd(), "ml_Files")
DATA_DIR = os.path.join(BASE_DIR, "data")
MODEL_DIR = os.path.join(BASE_DIR, "models")
os.makedirs(MODEL_DIR, exist_ok=True)

PREPROCESSED_FILE = os.path.join(DATA_DIR, "preprocessed_data.csv")
EVENT_MODEL_FILE = os.path.join(MODEL_DIR, "event_model.pkl")

def train():
    # Load preprocessed data
    df = pd.read_csv(PREPROCESSED_FILE)
    
    # Example: Train for Chennai (can loop over stations if needed)
    station = 'Chennai'
    df_station = df[df['station'] == station]
    
    features = ['tide','rainfall','temperature','wind_speed','ndvi','chlorophyll']
    X = df_station[features]
    y = df_station['cyclone']  # or 'flood', you can create separate models
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    clf = XGBClassifier(use_label_encoder=False, eval_metric='logloss')
    clf.fit(X_train, y_train)
    
    pickle.dump(clf, open(EVENT_MODEL_FILE, "wb"))
    print(f"Event classification model for {station} trained and saved to {EVENT_MODEL_FILE}")

if __name__ == "__main__":
    train()
