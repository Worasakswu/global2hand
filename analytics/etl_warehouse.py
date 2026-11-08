"""ETL: MongoDB (ข้อมูลแอป Global2Hand) -> PostgreSQL warehouse (star schema)

- Dimension (หมวดหมู่, จังหวัด, ผู้ใช้): upsert ทั้งหมดทุกรอบ เพราะข้อมูลมีน้อย
- fact_listings: incremental ดึงเฉพาะสินค้าที่ updatedAt >= watermark ของรอบก่อน
- fact_wishlist: full refresh ล้างแล้วโหลดใหม่ทั้งตาราง

รันซ้ำได้เสมอ (idempotent) เพราะทุกการโหลดเป็น upsert
"""
import os
from datetime import datetime

import psycopg2
from psycopg2.extras import execute_values
from pymongo import MongoClient

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB = os.getenv("MONGO_DB", "global2hand")
WAREHOUSE_DSN = os.getenv(
    "WAREHOUSE_DSN",
    "host=localhost port=5433 dbname=warehouse user=analytics password=analytics",
)
EPOCH = datetime(1970, 1, 1)


def date_key(dt):
    return int(dt.strftime("%Y%m%d")) if dt else None


# ---------- Extract ----------
def extract(mongo, watermark):
    categories = list(mongo.categories.find({}, {"name": 1}))
    users = list(mongo.users.find({}, {"name": 1, "province": 1, "isVerified": 1,
                                       "createdAt": 1, "wishlist": 1}))
    items = list(mongo.items.find({"updatedAt": {"$gte": watermark}}).sort("updatedAt", 1))
    return categories, users, items


# ---------- Transform ----------
def transform_listing(item, keys):
    """แปลง document ของ MongoDB หนึ่งชิ้นให้เป็นแถวของ fact_listings"""
    is_sold = item.get("status") == "Sold"
    created, updated = item["createdAt"], item["updatedAt"]
    days_to_sell = round((updated - created).total_seconds() / 86400, 2) if is_sold else None
    return (
        str(item["_id"]),
        keys["category"].get(str(item["category"])),
        keys["user"].get(str(item["seller"])),
        keys["province"].get(item.get("province")),
        date_key(created),
        date_key(updated) if is_sold else None,
        item["price"],
        is_sold,
        bool(item.get("isRecommended")),
        days_to_sell,
        updated,
    )


def wishlist_rows(users, keys):
    """แตก array wishlist ของผู้ใช้แต่ละคนออกเป็นหลายแถว (หนึ่งแถวต่อหนึ่งคู่ผู้ใช้-สินค้า)"""
    rows = set()
    for user in users:
        user_key = keys["user"][str(user["_id"])]
        for item_id in user.get("wishlist", []):
            rows.add((user_key, str(item_id)))
    return sorted(rows)


# ---------- Load ----------
def load_dimensions(cur, categories, users, items):
    execute_values(cur, """
        INSERT INTO dim_category (category_id, name) VALUES %s
        ON CONFLICT (category_id) DO UPDATE SET name = EXCLUDED.name
    """, [(str(c["_id"]), c["name"]) for c in categories])

    provinces = {u.get("province") for u in users} | {i.get("province") for i in items}
    provinces.discard(None)
    if provinces:
        execute_values(cur, """
            INSERT INTO dim_province (province_name) VALUES %s
            ON CONFLICT (province_name) DO NOTHING
        """, [(p,) for p in sorted(provinces)])

    execute_values(cur, """
        INSERT INTO dim_user (user_id, name, province, is_verified, joined_at) VALUES %s
        ON CONFLICT (user_id) DO UPDATE SET
            name = EXCLUDED.name, province = EXCLUDED.province,
            is_verified = EXCLUDED.is_verified, joined_at = EXCLUDED.joined_at
    """, [(str(u["_id"]), u.get("name"), u.get("province"), u.get("isVerified"),
           u.get("createdAt")) for u in users], page_size=1000)


def lookup_keys(cur):
    keys = {}
    for name, sql in [
        ("category", "SELECT category_id, category_key FROM dim_category"),
        ("user", "SELECT user_id, user_key FROM dim_user"),
        ("province", "SELECT province_name, province_key FROM dim_province"),
    ]:
        cur.execute(sql)
        keys[name] = dict(cur.fetchall())
    return keys


def load_listings(cur, rows):
    if not rows:
        return
    execute_values(cur, """
        INSERT INTO fact_listings (listing_id, category_key, seller_key, province_key,
            listed_date_key, sold_date_key, price, is_sold, is_recommended,
            days_to_sell, source_updated_at) VALUES %s
        ON CONFLICT (listing_id) DO UPDATE SET
            category_key = EXCLUDED.category_key, seller_key = EXCLUDED.seller_key,
            province_key = EXCLUDED.province_key, listed_date_key = EXCLUDED.listed_date_key,
            sold_date_key = EXCLUDED.sold_date_key, price = EXCLUDED.price,
            is_sold = EXCLUDED.is_sold, is_recommended = EXCLUDED.is_recommended,
            days_to_sell = EXCLUDED.days_to_sell,
            source_updated_at = EXCLUDED.source_updated_at, loaded_at = now()
    """, rows, page_size=1000)


def load_wishlist(cur, rows):
    cur.execute("TRUNCATE fact_wishlist")
    if rows:
        execute_values(cur, "INSERT INTO fact_wishlist (user_key, listing_id) VALUES %s",
                       rows, page_size=1000)


def get_watermark(cur):
    cur.execute("SELECT last_updated_at FROM etl_watermark WHERE source = 'items'")
    row = cur.fetchone()
    return row[0] if row else EPOCH


def set_watermark(cur, value):
    cur.execute("""
        INSERT INTO etl_watermark (source, last_updated_at) VALUES ('items', %s)
        ON CONFLICT (source) DO UPDATE
        SET last_updated_at = EXCLUDED.last_updated_at, last_run_at = now()
    """, (value,))


def main():
    mongo_client = MongoClient(MONGO_URI)
    mongo = mongo_client[MONGO_DB]
    conn = psycopg2.connect(WAREHOUSE_DSN)
    try:
        # ทุกขั้นอยู่ใน transaction เดียว ถ้าพังกลางทาง จะไม่มีอะไรถูกบันทึกครึ่ง ๆ กลาง ๆ
        with conn, conn.cursor() as cur:
            watermark = get_watermark(cur)
            categories, users, items = extract(mongo, watermark)

            load_dimensions(cur, categories, users, items)
            keys = lookup_keys(cur)

            load_listings(cur, [transform_listing(i, keys) for i in items])
            wishlist = wishlist_rows(users, keys)
            load_wishlist(cur, wishlist)

            new_watermark = items[-1]["updatedAt"] if items else watermark
            set_watermark(cur, new_watermark)

        print(f"watermark เดิม: {watermark}")
        print(f"listings ที่เปลี่ยนแปลง: {len(items)} แถว")
        print(f"wishlist: {len(wishlist)} แถว")
        print(f"watermark ใหม่: {new_watermark}")
    finally:
        conn.close()
        mongo_client.close()


if __name__ == "__main__":
    main()
