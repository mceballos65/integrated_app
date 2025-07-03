import os
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("sentence-transformers/all-mpnet-base-v2")

save_path = os.path.join(os.environ["HOME"], "all-mpnet-base-v2")
model.save(save_path)

# The only purpose of this script is to download the model and save it in the specified directory.