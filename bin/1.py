import ee
ee.Initialize()

# Define coastal area (bounding box or polygon)
area = ee.Geometry.Polygon([
    [[72.7, 18.9], [72.9, 18.9], [72.9, 19.2], [72.7, 19.2]]  # Example: Mumbai coast
])

# Get Sentinel-2 dataset
sentinel = ee.ImageCollection("COPERNICUS/S2") \
              .filterDate("2025-01-01", "2025-08-01") \
              .filterBounds(area) \
              .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))

# Pick median image
image = sentinel.median().clip(area)

# Use NDVI (vegetation) or water index (for algae detection)
ndvi = image.normalizedDifference(["B8", "B4"])  # NIR, Red

# Export or visualize
url = ndvi.getThumbURL({
    "region": area,
    "min": -1,
    "max": 1,
    "palette": ["blue", "green", "yellow", "red"]
})

print("NDVI Map URL:", url)
