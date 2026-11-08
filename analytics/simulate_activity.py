"""จำลองการใช้งานแอปช่วงหนึ่ง: มีคนขายของออก และมีประกาศใหม่เพิ่มเข้ามา

ใช้ทดสอบว่า ETL ดึงเฉพาะข้อมูลที่เปลี่ยน (incremental) ได้จริง
"""
import random
from datetime import datetime, timezone

from bson import ObjectId
from pymongo import MongoClient

client = MongoClient("mongodb://localhost:27017")
db = client["global2hand"]
now = datetime.now(timezone.utc).replace(tzinfo=None, microsecond=0)

# 1) สินค้าที่ยังไม่ขาย 50 ชิ้นถูกขายออก
available = list(db.items.aggregate([{"$match": {"status": "Available"}}, {"$sample": {"size": 50}}]))
for item in available:
    db.items.update_one({"_id": item["_id"]}, {"$set": {"status": "Sold", "updatedAt": now}})

# 2) มีประกาศใหม่ 20 ชิ้น (ใช้ข้อมูลของสินค้าเดิมเป็นแม่แบบ)
templates = list(db.items.aggregate([{"$sample": {"size": 20}}]))
new_items = []
for t in templates:
    t.update({"_id": ObjectId(), "status": "Available", "createdAt": now, "updatedAt": now,
              "isRecommended": random.random() < 0.1})
    new_items.append(t)
db.items.insert_many(new_items)

print(f"ขายออก {len(available)} ชิ้น, ประกาศใหม่ {len(new_items)} ชิ้น (เวลา {now})")
client.close()
