# 인덱스 생성
from app.db.nosql import mongo_db
from pymongo import ASCENDING, DESCENDING

def init_mongo():
    mongo_db.guest_verification_log.create_index([("user_id", ASCENDING)])
    mongo_db.guest_verification_log.create_index([("created_at", DESCENDING)])
