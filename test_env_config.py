#!/usr/bin/env python3
"""
Test script to verify environment variable configuration
"""
import os
import subprocess
import time

# Set test environment variables
test_env = {
    'DX_EXT_CFG_GIT_REPO': 'https://github.com/mceballos65/integrated_app_config.git',
    'DX_EXT_CFG_GIT_TOKEN': 'ghp_test_token_here',
    'DX_EXT_CFG_GIT_USER': 'mceballos65',
    'DX_EXT_CFG_GIT_BRANCH': 'acm_main_6_test',  # Test branch
    'DX_EXT_GUI_PASSWORD': 'testpassword123',
    'DX_EXT_GUI_USER': 'testuser',
    'DX_ENV_OU_GSMA_CODE': 'ABC'
}

def set_environment_variables():
    """Set environment variables for testing"""
    print("Setting test environment variables...")
    for key, value in test_env.items():
        os.environ[key] = value
        print(f"  {key}: {'***SET***' if 'TOKEN' in key or 'PASSWORD' in key else value}")

def test_environment_config():
    """Test the environment configuration loading"""
    print("\n=== Testing Environment Configuration ===")
    
    # Import after setting environment variables
    from main_advanced import load_environment_config, needs_wizard
    
    # Test loading environment config
    result = load_environment_config()
    print(f"Environment config loaded: {result}")
    
    # Test wizard requirement
    wizard_needed = needs_wizard()
    print(f"Wizard required: {wizard_needed}")
    
    return result

if __name__ == "__main__":
    print("=== Environment Configuration Test ===")
    
    # Set environment variables
    set_environment_variables()
    
    # Test the configuration
    try:
        success = test_environment_config()
        print(f"\n✅ Test completed successfully: {success}")
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
