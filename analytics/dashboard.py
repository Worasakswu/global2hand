"""Global2Hand Analytics Dashboard: อ่านข้อมูลจาก warehouse (star schema) มาแสดงผล"""
import os

import pandas as pd
import psycopg2
import streamlit as st

WAREHOUSE_DSN = os.getenv(
    "WAREHOUSE_DSN",
    "host=localhost port=5433 dbname=warehouse user=analytics password=analytics",
)

QUERY = """
SELECT f.listing_id,
       c.name          AS category,
       p.province_name AS province,
       d.full_date     AS listed_date,
       f.price,
       f.is_sold,
       f.is_recommended,
       f.days_to_sell,
       COALESCE(w.cnt, 0) AS wishlist_count
FROM fact_listings f
JOIN dim_category c USING (category_key)
JOIN dim_province p USING (province_key)
JOIN dim_date d ON d.date_key = f.listed_date_key
LEFT JOIN (SELECT listing_id, COUNT(*) AS cnt
           FROM fact_wishlist GROUP BY listing_id) w USING (listing_id)
"""

st.set_page_config(page_title="Global2Hand Analytics", page_icon="🛍️", layout="wide")


@st.cache_data(ttl=300)
def load_data():
    conn = psycopg2.connect(WAREHOUSE_DSN)
    try:
        with conn.cursor() as cur:
            cur.execute(QUERY)
            columns = [desc[0] for desc in cur.description]
            df = pd.DataFrame(cur.fetchall(), columns=columns)
    finally:
        conn.close()
    df["price"] = df["price"].astype(float)
    df["days_to_sell"] = pd.to_numeric(df["days_to_sell"], errors="coerce")
    df["listed_date"] = pd.to_datetime(df["listed_date"])
    df["category_short"] = df["category"].str.extract(r"\((.+)\)")[0].fillna(df["category"])
    return df


st.title("🛍️ Global2Hand Analytics")
st.caption("ข้อมูลจำลองจาก pipeline: MongoDB → ETL → PostgreSQL star schema")

df = load_data()
if df.empty:
    st.warning("warehouse ยังไม่มีข้อมูล ลองรัน python etl_warehouse.py ก่อน")
    st.stop()

# ----- ตัวกรอง -----
categories = sorted(df["category_short"].unique())
selected = st.sidebar.multiselect("หมวดหมู่", categories, default=categories)
if not selected:
    st.info("เลือกอย่างน้อย 1 หมวดหมู่จากแถบด้านซ้าย")
    st.stop()
df = df[df["category_short"].isin(selected)]

# ----- ตัวเลขภาพรวม -----
sold = df[df["is_sold"]]
c1, c2, c3, c4 = st.columns(4)
c1.metric("ประกาศทั้งหมด", f"{len(df):,}")
c2.metric("ขายออกแล้ว", f"{len(sold):,}")
c3.metric("อัตราขายออก", f"{df['is_sold'].mean():.1%}")
c4.metric("เวลาขายเฉลี่ย", f"{sold['days_to_sell'].mean():.1f} วัน")

# ----- ผลของการโปรโมต 20 บาท -----
st.subheader("การโปรโมต 20 บาทช่วยให้ขายออกไหม")
promo = df.groupby("is_recommended").agg(
    listings=("listing_id", "count"),
    sell_rate=("is_sold", "mean"),
    avg_days=("days_to_sell", "mean"),
    avg_wishlist=("wishlist_count", "mean"),
)
if {True, False} <= set(promo.index):
    p, n = promo.loc[True], promo.loc[False]
    m1, m2, m3 = st.columns(3)
    m1.metric("อัตราขายออก (โปรโมต)", f"{p.sell_rate:.1%}",
              f"{(p.sell_rate - n.sell_rate) * 100:+.1f} จุด เทียบกับไม่โปรโมต")
    m2.metric("เวลาขายเฉลี่ย (โปรโมต)", f"{p.avg_days:.1f} วัน",
              f"{p.avg_days - n.avg_days:+.1f} วัน", delta_color="inverse")
    m3.metric("wishlist เฉลี่ยต่อชิ้น (โปรโมต)", f"{p.avg_wishlist:.2f}",
              f"{p.avg_wishlist - n.avg_wishlist:+.2f}")
    st.caption(f"เทียบสินค้าโปรโมต {int(p.listings):,} ชิ้น กับสินค้าทั่วไป {int(n.listings):,} ชิ้น")
else:
    st.info("หมวดที่เลือกมีข้อมูลไม่พอสำหรับเปรียบเทียบ")

# ----- แยกตามหมวดหมู่ -----
st.subheader("แยกตามหมวดหมู่")
by_cat = df.groupby("category_short").agg(
    listings=("listing_id", "count"),
    sell_rate=("is_sold", "mean"),
    avg_price=("price", "mean"),
).sort_values("sell_rate", ascending=False)
left, right = st.columns(2)
left.markdown("**อัตราขายออก (%)**")
left.bar_chart((by_cat["sell_rate"] * 100).round(1))
right.markdown("**ราคาเฉลี่ย (บาท)**")
right.bar_chart(by_cat["avg_price"].round(0))

# ----- แยกตามจังหวัด -----
st.subheader("10 จังหวัดที่มีประกาศมากที่สุด")
by_prov = df.groupby("province").agg(
    listings=("listing_id", "count"),
    sell_rate=("is_sold", "mean"),
).sort_values("listings", ascending=False).head(10)
st.bar_chart(by_prov["listings"])

# ----- แนวโน้มรายสัปดาห์ -----
st.subheader("จำนวนประกาศใหม่รายสัปดาห์")
weekly = df.set_index("listed_date").resample("W")["listing_id"].count()
st.line_chart(weekly.rename("ประกาศใหม่"))

with st.expander("ดูตารางสรุปแยกหมวดหมู่"):
    st.dataframe(by_cat.style.format({"sell_rate": "{:.1%}", "avg_price": "{:,.0f}"}),
                 use_container_width=True)
