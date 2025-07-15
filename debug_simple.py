#!/usr/bin/env python3
"""Simple debug script to check config loading"""

# Test config loading directly
import json
import os

def check_app_config():
    config_path = "./app_data/config/app_config.json"
    
    print("=== CONFIG FILE DEBUG ===")
    print(f"1. Checking if file exists: {config_path}")
    print(f"   File exists: {os.path.exists(config_path)}")
    
    if os.path.exists(config_path):
        print("\n2. Reading file directly:")
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)
            
            print(f"   Config loaded successfully")
            print(f"   Top-level keys: {list(config.keys())}")
            
            if "github" in config:
                github_section = config["github"]
                print(f"\n3. GitHub section contents:")
                for key, value in github_section.items():
                    if key == "token":
                        print(f"   {key}: {'[EMPTY]' if not value else '[HAS_VALUE]'}")
                    else:
                        print(f"   {key}: '{value}'")
            else:
                print("\n3. NO GitHub section found!")
                
        except Exception as e:
            print(f"   ERROR reading file: {e}")
    
    print("\n=== CONFIG HANDLER TEST ===")
    try:
        # Test config_handler
        import sys
        sys.path.append('.')
        from config_handler import load_config, config_exists
        
        print(f"4. config_exists('app_config.json'): {config_exists('app_config.json')}")
        
        config = load_config('app_config.json')
        if config:
            print(f"5. load_config returned: {type(config)}")
            print(f"   Top-level keys: {list(config.keys())}")
            
            if "github" in config:
                github_section = config["github"]
                print(f"6. GitHub section from config_handler:")
                for key, value in github_section.items():
                    if key == "token":
                        print(f"   {key}: {'[EMPTY]' if not value else '[HAS_VALUE]'}")
                    else:
                        print(f"   {key}: '{value}'")
            else:
                print("6. NO GitHub section from config_handler!")
        else:
            print("5. load_config returned None!")
            
    except Exception as e:
        print(f"Error testing config_handler: {e}")

if __name__ == "__main__":
    check_app_config()
