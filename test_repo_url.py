import json

# Load current config
config_file = "app_data/config/app_config.json"

with open(config_file, 'r') as f:
    config = json.load(f)

print("Current GitHub config:")
print(json.dumps(config.get("github", {}), indent=2))

# Update repositoryUrl
if "github" not in config:
    config["github"] = {}

config["github"]["repositoryUrl"] = "https://github.com/test/test.git"

# Save updated config
with open(config_file, 'w') as f:
    json.dump(config, f, indent=2)

print("\nUpdated GitHub config:")
print(json.dumps(config.get("github", {}), indent=2))
print("\nRepositoryUrl updated manually!")
