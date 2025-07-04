import re
import os
import json
import uuid
import logging
from sentence_transformers import SentenceTransformer
from fastapi import Request
import numpy as np
from config import SIMILARITY_THRESHOLD, ENABLE_LOGGING, LOG_FILE_PATH, DATA_FILE

# Set environment to be fully offline
os.environ["TRANSFORMERS_OFFLINE"] = "1"

#  Text normalization function
def normalize_text(text):
    text = text.lower()
    text = re.sub(r"[^\w\s]", " ", text)  # Replace punctuation with a space
    text = re.sub(r"\s+", " ", text)
    return text.strip()

# Initialize the database
def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r") as f:
            return json.load(f)
    return []

# Here we load the accounts database
def load_disabled_by_matcher(file_path="accounts.json"):
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            raw = json.load(f)
        return {matcher: set(accounts) for matcher, accounts in raw.items()}
    except FileNotFoundError:
        return {}
    
# Here we save the accounts database
def save_disabled_by_matcher(data, file_path="accounts.json"):
    serializable_data = {k: list(v) for k, v in data.items()}
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(serializable_data, f, indent=2)


# save database
def save_data(data):
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=2)


# Initialize the model
def load_model():
    model_path = os.path.expanduser("~/all-mpnet-base-v2")
    # model_path = os.path.expanduser("./all-mpnet-base-v2")
    return SentenceTransformer(model_path)


# Update the embeddings
def generate_embeddings(data, model):
    if data:
        texts = [normalize_text(item["phrase"]) for item in data]
        return model.encode(texts)
    else:
        return np.array([])

# Configure logging
def setup_logging():
    if ENABLE_LOGGING:
        os.makedirs(os.path.dirname(LOG_FILE_PATH), exist_ok=True)
        logging.basicConfig(
            filename=LOG_FILE_PATH,
            level=logging.INFO,
            format="%(asctime)s - %(message)s",
        )

# Configure logging function
def log_event(tag: str, message: str, request: Request = None):
    ip = request.client.host if request else "N/A"
    logging.info(f"[{tag}] {message} | IP: {ip}")