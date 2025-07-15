import requests
import json

try:
    print("Testing debug config endpoint...")
    response = requests.get("http://localhost:8000/debug/config")
    
    if response.status_code == 200:
        debug_info = response.json()
        print("Debug info:")
        print(json.dumps(debug_info, indent=2))
    else:
        print(f"Error: {response.status_code}")
        print(response.text)
        
except Exception as e:
    print(f"Error: {e}")

input("Press enter to continue...")
