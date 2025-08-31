import requests
import json

# MSG91 API Key
API_KEY = "466852ALEZ2uV5x7I168b326cfP1"
SENDER_ID = "abc160"   # 6-char sender ID approved in MSG91
ROUTE = "4"              # "4" for transactional messages in India

# Recipients (no need to verify numbers)
recipients = ["+917041494355"]

# High alert message
alert_message = """🚨 HIGH ALERT: Cyclonic activity detected near Mumbai coast.
Expected landfall in 6 hrs.
Evacuation advisory issued.
Stay safe.
- Coastal Threat Alert System"""

# MSG91 endpoint
url = "https://control.msg91.com/api/v5/flow/"

# Payload for sending SMS
payload = {
    "sender": SENDER_ID,
    "route": ROUTE,
    "mobiles": ",".join(recipients),
    "message": alert_message
}

# Headers
headers = {
    "accept": "application/json",
    "authkey": API_KEY,
    "content-type": "application/json"
}

# Send SMS
response = requests.post("https://api.msg91.com/api/v2/sendsms", 
                         headers=headers, 
                         data=json.dumps(payload))

print("Response:", response.json())
