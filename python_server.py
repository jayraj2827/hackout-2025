# python_server.py  (place at project root: Hackout2025/python_server.py)
from flask import Flask
from pathlib import Path
import sys, os
from flask import jsonify
import ee
PROJECT_ROOT = Path(__file__).resolve().parent
TEMPLATES_DIR = PROJECT_ROOT / "flask_app" / "templates"
STATIC_DIR = PROJECT_ROOT / "flask_app" / "static"

ee.Initialize(project='verdant-nova-470617-v8')
# Ensure project root is on sys.path so "ml_Files" package imports work
sys.path.insert(0, str(PROJECT_ROOT))

# create app with explicit template/static folders
app = Flask(
    __name__,
    template_folder=str(TEMPLATES_DIR),
    static_folder=str(STATIC_DIR)
)
@app.route("/get_satellite_layer")
def get_satellite_layer():
    # Example: Sentinel-2 for July 2024
    collection = (ee.ImageCollection("COPERNICUS/S2_SR")
                  .filterDate('2024-07-01', '2024-07-31')
                  .filterBounds(ee.Geometry.Point([77.2090, 28.6139])))  # adjust to your region
    
    image = collection.median()

    # NDVI (proxy for algae/vegetation health)
    ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI')

    vis_params = {
        'min': 0,
        'max': 1,
        'palette': ['blue', 'white', 'green']
    }

    map_id = ee.data.getMapId({
        'image': ndvi,
        'vis_params': vis_params
    })

    tile_url = (
        f"https://earthengine.googleapis.com/v1/projects/earthengine-legacy/maps/"
        f"{map_id['mapid']}/tiles/{{z}}/{{x}}/{{y}}?token={map_id['token']}"
    )

    return jsonify({"tile_url": tile_url})
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-me')
# import routes after sys.path tweak
from routes import bp as routes_bp
app.register_blueprint(routes_bp)

if __name__ == "__main__":
    # Run from project root: python python_server.py
    app.run(debug=True, host="0.0.0.0", port=2827)
