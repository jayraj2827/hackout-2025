# routes.py  (place at project root: Hackout2025/routes.py)
from flask import Blueprint, jsonify, render_template, current_app,flash,redirect,url_for
from pathlib import Path
import sys, os
import mysql.connector
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Make sure project root is available for importing ml_Files
PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

bp = Blueprint("routes", __name__)

SENDER_EMAIL = "friday.desktop.ai@gmail.com"
PASSWORD = "venq nbfo xgvj uixb"

def get_db_connection():
    conn = mysql.connector.connect(
        host="localhost",
        user="root",          # your MySQL user
        password="", # MySQL password
        database="coastal_alert"
    )
    return conn


def get_all_users():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT email FROM users")
    emails = [row[0] for row in cursor.fetchall()]
    conn.close()
    return emails


def send_alert_email(recipients, subject, body):
    msg = MIMEMultipart()
    msg['From'] = SENDER_EMAIL
    msg['To'] = ", ".join(recipients)
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'plain'))

    try:
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(SENDER_EMAIL, PASSWORD)
            server.sendmail(SENDER_EMAIL, recipients, msg.as_string())
        return True
    except Exception as e:
        print("Email send error:", e)
        return False


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

@bp.route("/send_alert", methods=["POST"])
def send_alert():
    recipients = get_all_users()
    subject = "🚨 HIGH ALERT: Coastal Threat"
    body = """High alert! Cyclone detected near the coast.
Expected landfall in 6 hours.
Evacuation advisory issued.
Stay safe.
- Coastal Threat Alert System"""

    ok = False
    try:
        ok = send_alert_email(recipients, subject, body)
    except Exception:
        # log full exception
        current_app.logger.exception("Exception while sending alert emails")

    if ok:
        flash(f"✅ Alert sent to {len(recipients)} users.", "success")
    else:
        # use 'danger' (Bootstrap convention) instead of 'error'
        flash("❌ Failed to send alert. Check server logs for details.", "danger")

    # redirect back to this blueprint's dashboard
    return redirect(url_for("routes.dashboard"))

@bp.route("/")
def dashboard():
    return render_template("dashboard.html")
