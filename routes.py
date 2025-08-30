# routes.py  (place at project root: Hackout2025/routes.py)
from flask import Blueprint, jsonify, render_template, current_app
from pathlib import Path
import sys, os

# Make sure project root is available for importing ml_Files
PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

bp = Blueprint("routes", __name__)

# Import ML function (this uses ml_Files/predict_and_alert_live.py)
try:
    from ml_Files.predict_and_alert_live import run_live_alert
except Exception as e:
    # don't crash import time — surface helpful log
    run_live_alert = None
    print("Warning: could not import run_live_alert:", e)

@bp.route("/api/live_alerts")
def live_alerts():
    if run_live_alert is None:
        return jsonify({"error": "ML code not available on server (inspect server logs)"}), 500
    try:
        data = run_live_alert()
        return jsonify(data)
    except Exception as e:
        current_app.logger.exception("live_alerts failed")
        return jsonify({"error": str(e)}), 500

@bp.route("/")
def dashboard():
    return render_template("dashboard.html")
