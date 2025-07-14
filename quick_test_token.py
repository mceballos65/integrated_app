#!/usr/bin/env python3
"""
Quick test to check if token exists
"""

import requests

def test_token_exists():
    try:
        response = requests.get("http://localhost:8000/config/github/token/exists")
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        return response.json().get("exists", False)
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    exists = test_token_exists()
    print(f"Token exists: {exists}")
