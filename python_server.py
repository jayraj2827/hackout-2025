# python_server.py  (place at project root: Hackout2025/python_server.py)
from flask import Flask
from pathlib import Path
import sys, os

PROJECT_ROOT = Path(__file__).resolve().parent
TEMPLATES_DIR = PROJECT_ROOT / "flask_app" / "templates"
STATIC_DIR = PROJECT_ROOT / "flask_app" / "static"

# Ensure project root is on sys.path so "ml_Files" package imports work
sys.path.insert(0, str(PROJECT_ROOT))

# create app with explicit template/static folders
app = Flask(
    __name__,
    template_folder=str(TEMPLATES_DIR),
    static_folder=str(STATIC_DIR)
)

# import routes after sys.path tweak
from routes import bp as routes_bp
app.register_blueprint(routes_bp)

if __name__ == "__main__":
    # Run from project root: python python_server.py
    app.run(debug=True, host="0.0.0.0", port=2827)
