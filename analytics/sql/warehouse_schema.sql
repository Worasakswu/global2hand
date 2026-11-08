-- Star schema ของ Global2Hand warehouse
-- รันซ้ำได้ (IF NOT EXISTS / ON CONFLICT)

-- ===== Dimension tables =====
CREATE TABLE IF NOT EXISTS dim_category (
    category_key SERIAL PRIMARY KEY,
    category_id  TEXT UNIQUE NOT NULL,      -- _id จาก MongoDB
    name         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dim_province (
    province_key  SERIAL PRIMARY KEY,
    province_name TEXT UNIQUE NOT NULL
);

-- ผู้ใช้เป็นได้ทั้งผู้ขายและผู้ซื้อ จึงใช้ dimension เดียว
CREATE TABLE IF NOT EXISTS dim_user (
    user_key    SERIAL PRIMARY KEY,
    user_id     TEXT UNIQUE NOT NULL,       -- _id จาก MongoDB
    name        TEXT,
    province    TEXT,
    is_verified BOOLEAN,
    joined_at   TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dim_date (
    date_key    INT PRIMARY KEY,            -- รูปแบบ YYYYMMDD เช่น 20261108
    full_date   DATE NOT NULL,
    year        INT,
    month       INT,
    day         INT,
    day_of_week INT,                        -- 1 = จันทร์ ... 7 = อาทิตย์
    is_weekend  BOOLEAN
);

INSERT INTO dim_date
SELECT TO_CHAR(d, 'YYYYMMDD')::INT,
       d::DATE,
       EXTRACT(YEAR FROM d)::INT,
       EXTRACT(MONTH FROM d)::INT,
       EXTRACT(DAY FROM d)::INT,
       EXTRACT(ISODOW FROM d)::INT,
       EXTRACT(ISODOW FROM d) IN (6, 7)
FROM generate_series('2025-01-01'::DATE, '2027-12-31'::DATE, '1 day') AS d
ON CONFLICT (date_key) DO NOTHING;

-- ===== Fact tables =====
-- หนึ่งแถวต่อหนึ่งประกาศขาย และอัปเดตแถวเดิมเมื่อสถานะเปลี่ยน (accumulating snapshot)
CREATE TABLE IF NOT EXISTS fact_listings (
    listing_id        TEXT PRIMARY KEY,     -- _id จาก MongoDB
    category_key      INT REFERENCES dim_category(category_key),
    seller_key        INT REFERENCES dim_user(user_key),
    province_key      INT REFERENCES dim_province(province_key),
    listed_date_key   INT REFERENCES dim_date(date_key),
    sold_date_key     INT REFERENCES dim_date(date_key),
    price             NUMERIC(12, 2),
    is_sold           BOOLEAN,
    is_recommended    BOOLEAN,
    days_to_sell      NUMERIC(8, 2),
    source_updated_at TIMESTAMP,
    loaded_at         TIMESTAMP DEFAULT now()
);

-- ใครกด wishlist สินค้าชิ้นไหน (โหลดใหม่ทั้งตารางทุกรอบ)
CREATE TABLE IF NOT EXISTS fact_wishlist (
    user_key   INT REFERENCES dim_user(user_key),   -- ผู้ใช้ที่กดถูกใจ
    listing_id TEXT,
    PRIMARY KEY (user_key, listing_id)
);

-- ===== ETL metadata =====
CREATE TABLE IF NOT EXISTS etl_watermark (
    source          TEXT PRIMARY KEY,
    last_updated_at TIMESTAMP NOT NULL,
    last_run_at     TIMESTAMP DEFAULT now()
);
