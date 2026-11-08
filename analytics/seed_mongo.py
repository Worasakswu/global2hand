"""สร้างข้อมูลจำลองของ Global2Hand ลง MongoDB (โครงสร้างเดียวกับ models/ ของแอป)

ข้อมูลทั้งหมดเป็นข้อมูลสมมติ ใช้สำหรับทดสอบ pipeline เท่านั้น
รันซ้ำได้: ทุกครั้งจะลบข้อมูลเดิมแล้วสร้างใหม่ด้วย seed เดิม ได้ผลลัพธ์เหมือนเดิมทุกครั้ง
"""
import random
from datetime import datetime, timedelta

from bson import ObjectId
from pymongo import MongoClient

MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "global2hand"
N_USERS = 500
N_ITEMS = 5000
DAYS_BACK = 180
NOW = datetime(2026, 11, 1)

random.seed(42)

# หมวดหมู่เดียวกับ config/db.js ของแอป: (ชื่อ, ช่วงราคา, โอกาสขายออกพื้นฐาน, ตัวอย่างสินค้า)
CATEGORIES = [
    ("แฟชั่นผู้หญิง (Woman's Fashion)", (150, 2500), 0.45, ["เดรส", "กระเป๋าถือ", "รองเท้าส้นสูง", "เสื้อคลุม"]),
    ("แฟชั่นผู้ชาย (Men's Fashion)", (150, 3000), 0.40, ["เสื้อเชิ้ต", "กางเกงยีนส์", "รองเท้าผ้าใบ", "นาฬิกา"]),
    ("อิเล็กทรอนิกส์ (Electronics)", (800, 35000), 0.55, ["iPhone", "หูฟังไร้สาย", "โน้ตบุ๊ก", "กล้องถ่ายรูป", "iPad"]),
    ("บ้านและไลฟ์สไตล์ (Home & Lifestyle)", (200, 8000), 0.35, ["โต๊ะไม้", "เก้าอี้", "พัดลม", "หม้อหุงข้าว", "โคมไฟ"]),
    ("ยาและเวชภัณฑ์ (Medicine)", (100, 3000), 0.20, ["เครื่องวัดความดัน", "ไม้ค้ำยัน", "รถเข็นผู้ป่วย"]),
    ("กีฬาและกิจกรรมกลางแจ้ง (Sports & Outdoor)", (300, 15000), 0.40, ["จักรยาน", "ไม้แบด", "เต็นท์", "ดัมเบล"]),
    ("แม่และเด็ก / ของเล่น (Baby's & Toys)", (100, 6000), 0.50, ["รถเข็นเด็ก", "เลโก้", "คาร์ซีท", "ตุ๊กตา"]),
    ("ของกินและสัตว์เลี้ยง (Groceries & Pets)", (80, 3000), 0.30, ["กรงแมว", "ที่นอนสุนัข", "ตู้ปลา"]),
    ("สุขภาพและความงาม (Health & Beauty)", (100, 4000), 0.35, ["ไดร์เป่าผม", "เครื่องหนีบผม", "น้ำหอม"]),
]

# จังหวัดและน้ำหนัก (กรุงเทพฯ มีผู้ใช้มากที่สุด)
PROVINCES = {
    "กรุงเทพมหานคร": 30, "นนทบุรี": 8, "ปทุมธานี": 7, "สมุทรปราการ": 7,
    "ชลบุรี": 6, "เชียงใหม่": 6, "ขอนแก่น": 5, "นครราชสีมา": 5,
    "ภูเก็ต": 4, "สงขลา": 4, "อุดรธานี": 3, "พิษณุโลก": 3,
    "สุราษฎร์ธานี": 3, "นครปฐม": 3, "เชียงราย": 2,
}
FIRST_NAMES = ["สมชาย", "สมหญิง", "วิชัย", "สุดา", "ณัฐพล", "ปิยะ", "อรุณี", "ธนา",
               "กมล", "ศิริ", "พงษ์", "มาลี", "อนันต์", "จิราพร", "ประเสริฐ", "วรรณา"]
LAST_NAMES = ["ใจดี", "แสงทอง", "สุขสันต์", "ศรีสุข", "มั่นคง", "บุญมา", "ทองดี", "รุ่งเรือง"]
CONDITIONS = ["สภาพดี", "สภาพ 90%", "มือสองสภาพนางฟ้า", "ใช้งานปกติ", "มีรอยเล็กน้อย"]


def random_date(start, end):
    return start + timedelta(seconds=random.randint(0, int((end - start).total_seconds())))


def build_categories():
    return [{"_id": ObjectId(), "name": name, "__v": 0} for name, *_ in CATEGORIES]


def build_users():
    provinces, weights = zip(*PROVINCES.items())
    users = []
    for i in range(N_USERS):
        first, last = random.choice(FIRST_NAMES), random.choice(LAST_NAMES)
        created = random_date(NOW - timedelta(days=DAYS_BACK + 60), NOW - timedelta(days=1))
        users.append({
            "_id": ObjectId(),
            "name": f"{first} {last}",
            "firstName": first,
            "lastName": last,
            "email": f"user{i:04d}@example.com",
            "province": random.choices(provinces, weights)[0],
            "role": "admin" if i < 2 else "user",
            "isVerified": random.random() < 0.7,
            "wishlist": [],
            "createdAt": created,
            "updatedAt": created,
            "__v": 0,
        })
    return users


def build_items(categories, users):
    items = []
    for _ in range(N_ITEMS):
        idx = random.randrange(len(CATEGORIES))
        _, (low, high), base_sell_rate, products = CATEGORIES[idx]
        seller = random.choice(users)
        created = random_date(max(seller["createdAt"], NOW - timedelta(days=DAYS_BACK)), NOW)
        is_recommended = random.random() < 0.10

        # สินค้าที่จ่ายโปรโมต 20 บาทมีโอกาสขายออกสูงกว่าและขายเร็วกว่า (สมมติฐานของข้อมูลจำลอง)
        sell_rate = min(base_sell_rate * (1.6 if is_recommended else 1.0), 0.95)
        days_listed = (NOW - created).days
        sold = random.random() < sell_rate and days_listed >= 1
        if sold:
            mean_days = 4 if is_recommended else 10
            days_to_sell = min(random.expovariate(1 / mean_days), days_listed)
            updated = created + timedelta(days=days_to_sell)
        else:
            updated = random_date(created, NOW) if random.random() < 0.3 else created

        product = random.choice(products)
        items.append({
            "_id": ObjectId(),
            "name": f"{product} {random.choice(CONDITIONS)}",
            "price": round(random.uniform(low, high), -1),
            "description": f"ขาย{product}มือสอง {random.choice(CONDITIONS)} นัดรับได้",
            "images": [],
            "category": categories[idx]["_id"],
            "tags": [product],
            "province": seller["province"],
            "phone": f"08{random.randint(10000000, 99999999)}",
            "seller": seller["_id"],
            "status": "Sold" if sold else "Available",
            "isRecommended": is_recommended,
            "createdAt": created,
            "updatedAt": updated,
            "__v": 0,
        })
    return items


def fill_wishlists(users, items):
    """ผู้ใช้แต่ละคนกดถูกใจสินค้า 0-15 ชิ้น (สินค้าโปรโมตถูกกดบ่อยกว่า)"""
    weights = [3 if it["isRecommended"] else 1 for it in items]
    for user in users:
        picks = random.choices(items, weights, k=random.randint(0, 15))
        user["wishlist"] = list({it["_id"] for it in picks if it["seller"] != user["_id"]})


def main():
    categories = build_categories()
    users = build_users()
    items = build_items(categories, users)
    fill_wishlists(users, items)

    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    for name, docs in [("categories", categories), ("users", users), ("items", items)]:
        db[name].drop()
        db[name].insert_many(docs)
        print(f"{name}: {db[name].count_documents({})} documents")
    client.close()


if __name__ == "__main__":
    main()
