# server.py
from flask import Flask, jsonify
from ml_Files.predict_and_alert_live import run_live_alert  # Your improved script

app = Flask(__name__)

@app.route('/alerts', methods=['GET'])
def get_alerts():
    try:
        live_data = run_live_alert() 
        return jsonify(live_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=2827)
