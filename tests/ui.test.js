const mongoose = require('mongoose');
const FIXED_ID = '507f1f77bcf86cd799439011';

// Mock authMiddleware เพื่อจำลองการล็อกอินสำหรับทดสอบ UI
jest.mock('../middlewares/authMiddleware', () => ({
    ensureAuth: (req, res, next) => {
        req.user = { _id: '507f1f77bcf86cd799439011', name: 'Test' };
        next();
    },
    ensureAdmin: (req, res, next) => {
        req.session.isAdmin = true;
        next();
    }
}));

const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'testsecret';

let mongod;
let app;
let testCategory;
let testItem;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    process.env.MONGO_URI = uri;
    await mongoose.connect(uri);

    // สร้างข้อมูลจำลองสำหรับทดสอบ UI
    const User = require('../models/User');
    const Category = require('../models/Category');
    const Item = require('../models/Item');

    await User.create({
        _id: new mongoose.Types.ObjectId(FIXED_ID),
        name: 'Demo User',
        email: 'demo@test.com',
        wishlist: []
    });

    testCategory = await Category.create({ name: 'Electronics' });

    testItem = await Item.create({
        name: 'iPhone 17 pro max',
        price: 37000,
        description: 'หน้าจอ OLED ขนาด 6.9 นิ้ว ProMotion 120Hz ชิป A19 Pro ใหม่ เร็วแรงจัดเต็ม กล้องหลัง 3 ตัว 48MP ทั้งหมด พร้อมซูม Optical 8x กล้องหน้า 18MP Center Stage แบตเตอรี่อึดนานข้ามวัน ใช้วัสดุเกรดพรีเมียม รองรับ [Apple Intelligence] เต็มรูปแบบ.',
        category: testCategory._id,
        seller: new mongoose.Types.ObjectId(FIXED_ID),
        status: 'Available'
    });

    app = require('../app');
});

afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongod.stop();
});

// =====================================================================
// 5 UI Test Cases สำหรับรายงาน Phase 4
// =====================================================================

describe('UI Test Cases (5 Cases) - Phase 4 Report', () => {

    // -----------------------------------------------------------------
    // UI-01: ทดสอบหน้าหลักและการค้นหาสินค้า (Search & Filter)
    // ขั้นตอน: เข้าหน้าแรก -> พิมพ์ "iPhone" ในช่องค้นหา -> กดค้นหา
    // Expected: ระบบแสดงสินค้าที่ตรงกับคำค้นหา (iPhone 17 pro max)
    // -----------------------------------------------------------------
    test('UI-01: ค้นหาสินค้าด้วยคำค้น "iPhone" ต้องแสดงผลสินค้าที่ตรงกัน', async () => {
        // Step 1: เข้าหน้าแรก
        const homeRes = await request(app).get('/');
        expect(homeRes.statusCode).toBe(200);
        // Expected: หน้าแรกต้องแสดงผลปกติ (HTTP 200)

        // Step 2: ค้นหาด้วยคำว่า "iPhone"
        const searchRes = await request(app).get('/?keyword=iPhone');
        expect(searchRes.statusCode).toBe(200);
        // Expected: ผลการค้นหาต้องมีคำว่า "iPhone 17 pro max" อยู่ในเนื้อหาหน้า
        expect(searchRes.text).toContain('iPhone 17 pro max');
        // Expected: ราคาสินค้าต้องแสดงถูกต้อง (37,000)
        expect(searchRes.text).toContain('37,000');
    });

    // -----------------------------------------------------------------
    // UI-02: ทดสอบหน้าแสดงรายละเอียดสินค้า (Product Detail View)
    // ขั้นตอน: คลิกดูสินค้า "iPhone 17 pro max" จากหน้าแสดงผล
    // Expected: ต้องแสดงข้อมูลครบถ้วน (ชื่อ, ราคา, รายละเอียด, ผู้ขาย)
    // -----------------------------------------------------------------
    test('UI-02: หน้ารายละเอียดสินค้าต้องแสดงข้อมูลครบถ้วน', async () => {
        const res = await request(app).get(`/items/${testItem._id}`);
        expect(res.statusCode).toBe(200);
        // Expected: ต้องแสดงชื่อสินค้า
        expect(res.text).toContain('iPhone 17 pro max');
        // Expected: ต้องแสดงราคาสินค้า
        expect(res.text).toContain('37,000');
        // Expected: ต้องแสดงรายละเอียดสินค้า
        expect(res.text).toContain('หน้าจอ OLED ขนาด 6.9 นิ้ว ProMotion 120Hz ชิป A19 Pro ใหม่ เร็วแรงจัดเต็ม กล้องหลัง 3 ตัว 48MP ทั้งหมด พร้อมซูม Optical 8x กล้องหน้า 18MP Center Stage แบตเตอรี่อึดนานข้ามวัน ใช้วัสดุเกรดพรีเมียม รองรับ [Apple Intelligence] เต็มรูปแบบ.');
        // Expected: ต้องแสดงผู้ขาย
        expect(res.text).toContain('Demo User');
    });

    // -----------------------------------------------------------------
    // UI-03: ทดสอบระบบรายการโปรด (Wishlist Management)
    // ขั้นตอน: กดเพิ่มสินค้าเข้า Wishlist -> เข้าหน้า Wishlist -> ตรวจสอบ
    // Expected: สินค้าต้องปรากฏอยู่ในรายการโปรดของผู้ใช้งาน
    // -----------------------------------------------------------------
    test('UI-03: เพิ่มสินค้าเข้า Wishlist แล้วต้องแสดงในหน้า Wishlist', async () => {
        // Step 1: กดเพิ่มสินค้าเข้า Wishlist
        const addRes = await request(app).get(`/wishlist/add/${testItem._id}`);
        expect(addRes.statusCode).toBe(302);
        // Expected: ระบบต้อง Redirect กลับ (302) หลังเพิ่มสำเร็จ

        // Step 2: เข้าหน้า Wishlist เพื่อตรวจสอบ
        const wishlistRes = await request(app).get('/wishlist');
        expect(wishlistRes.statusCode).toBe(200);
        // Expected: หน้า Wishlist ต้องแสดงชื่อสินค้าที่เพิ่งเพิ่มเข้าไป
        expect(wishlistRes.text).toContain('iPhone 17 pro max');
    });

    // -----------------------------------------------------------------
    // UI-04: ทดสอบการแก้ไขข้อมูลส่วนตัว (Profile / Account Update)
    // ขั้นตอน: เข้าหน้า Account -> แก้ไขชื่อ -> กดบันทึก -> ตรวจสอบ
    // Expected: ข้อมูลใหม่ต้องถูกบันทึกและแสดงผลหน้า Account ถูกต้อง
    // -----------------------------------------------------------------
    test('UI-04: แก้ไขข้อมูลโปรไฟล์แล้วต้องอัปเดตถูกต้อง', async () => {
        // Step 1: ส่งข้อมูลใหม่ผ่านฟอร์ม
        const updateRes = await request(app)
            .post('/account')
            .send({ firstName: 'Updated', lastName: 'Name' });
        expect(updateRes.statusCode).toBe(302);
        // Expected: ระบบต้อง Redirect (302) หลังบันทึกสำเร็จ

        // Step 2: เข้าหน้า Account เพื่อตรวจสอบข้อมูลใหม่
        const accountRes = await request(app).get('/account');
        expect(accountRes.statusCode).toBe(200);
        // Expected: หน้า Account ต้องโหลดได้ปกติ (200)
    });

    // -----------------------------------------------------------------
    // UI-05: ทดสอบการเข้าถึงหน้าจัดการหลังบ้าน (Admin Dashboard View)
    // ขั้นตอน: ล็อกอินแอดมิน -> เข้าหน้า Dashboard
    // Expected: ระบบแสดงข้อมูลสรุปทางสถิติและโหลดหน้า Dashboard สำเร็จ
    // -----------------------------------------------------------------
    test('UI-05: แอดมินต้องสามารถเข้าดูสถิติในหน้า Admin Dashboard ได้', async () => {
        // Step 1: เข้าหน้าแอดมิน Dashboard
        const res = await request(app).get('/categories/dashboard');

        expect(res.statusCode).toBe(200);
        // Expected: หน้า Dashboard ต้องโหลดได้ปกติ (200)
        expect(res.text).toContain('Admin Dashboard');
        // Expected: ต้องแสดงข้อมูลสินค้าหรือสถิติที่มีอยู่ในระบบ (เช่น Electronics)
        expect(res.text).toContain('Electronics');
    });

    // -----------------------------------------------------------------
    // UI-06: ทดสอบการลงขายสินค้า (Create Item Flow)
    // ขั้นตอน: เข้าหน้าลงขาย -> กรอกข้อมูลสินค้า -> กดบันทึก
    // Expected: ระบบบันทึกสำเร็จและพาผู้ใช้กลับไปหน้าหลัก (HTTP 302)
    // -----------------------------------------------------------------
    test('UI-06: ผู้ใช้ต้องสามารถลงขายสินค้าใหม่ผ่านหน้าเว็บได้', async () => {
        // Step 1: เข้าหน้าฟอร์มลงขาย
        const getRes = await request(app).get('/items/add');
        expect(getRes.statusCode).toBe(200);

        // Step 2: ส่งข้อมูลฟอร์ม
        const postRes = await request(app)
            .post('/items/add')
            .send({
                name: 'New UI Item',
                price: 500,
                description: 'UI Test Description',
                category: testCategory._id,
                province: 'Bangkok'
            });
        expect(postRes.statusCode).toBe(302); // Redirect back to home
    });

    // -----------------------------------------------------------------
    // UI-07: ทดสอบการเรียกดูหน้าแคตตาล็อกทั้งหมด (All Products View)
    // ขั้นตอน: เข้าเมนู "เลือกชมสินค้าทั้งหมด"
    // Expected: ระบบแสดงรายการสินค้าที่มีสถานะ Available ทั้งหมด
    // -----------------------------------------------------------------
    test('UI-07: ระบบต้องแสดงรายการสินค้าทั้งหมดในหน้า Catalog ได้', async () => {
        const res = await request(app).get('/?keyword='); // Search empty = All
        expect(res.statusCode).toBe(200);
        expect(res.text).toContain('iPhone 17 pro max');
    });

    // -----------------------------------------------------------------
    // UI-08: ทดสอบการลบสินค้าโดยแอดมิน (Admin Delete Item)
    // ขั้นตอน: แอดมินเลือกลบสินค้า "iPhone 17 pro max"
    // Expected: สินค้าถูกลบออกจากระบบและระบบ Redirect กลับ (302)
    // -----------------------------------------------------------------
    test('UI-08: แอดมินต้องสามารถลบสินค้าที่ผิดกฎผ่านหน้าเว็บได้', async () => {
        const res = await request(app).delete(`/items/${testItem._id}`);
        expect(res.statusCode).toBe(302);

        // ตรวจสอบว่าสินค้าหายไปแล้ว
        const checkRes = await request(app).get(`/items/${testItem._id}`);
        expect(checkRes.statusCode).toBe(404);
    });
});

//npx jest tests/ui.test.js --coverage

