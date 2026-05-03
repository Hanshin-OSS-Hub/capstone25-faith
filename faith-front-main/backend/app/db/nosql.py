import os
from pymongo import MongoClient

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "capstone_db")

client = MongoClient(MONGO_URL)
mongo_db = client[MONGO_DB_NAME]
