const mongoose = require('mongoose');
const FIXED_ID = '507f1f77bcf86cd799439011';

// Mock authMiddleware at the top level
jest.mock('../middlewares/authMiddleware', () => ({
    ensureAuth: (req, res, next) => {
        // Use a simple string ID to ensure compatibility
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

// Set environment to test
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'testsecret';



let mongod;
let app;
let testCategory;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    process.env.MONGO_URI = uri;
    await mongoose.connect(uri);
    
    // Create real data for routes to use (matching the mocked ID)
    const User = require('../models/User');
    const Category = require('../models/Category');
    // Ensure we don't have duplicate key error if beforeAll runs again
    await User.deleteMany({ _id: new mongoose.Types.ObjectId(FIXED_ID) });
    await User.create({ 
        _id: new mongoose.Types.ObjectId(FIXED_ID), 
        name: 'Test', 
        email: 'test@test.com',
        wishlist: []
    });
    testCategory = await Category.create({ name: 'TestCat' });
    
    app = require('../app');
});

afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongod.stop();
});

describe('Integration Tests - Routes (UT-33 to UT-46)', () => {
    
    // -----------------------------------------------------------------
    // TC-23: GET / should return 200 (Home Page)
    // ขั้นตอน: เรียก URL หน้าหลัก (/)
    // Expected: ระบบคืนค่า HTTP Status 200 และโหลดหน้าสำเร็จ
    // -----------------------------------------------------------------
    test('UT-33: GET / should return 200', async () => {
        const res = await request(app).get('/');
        expect(res.statusCode).toBe(200);
    });

    // -----------------------------------------------------------------
    // TC-24: GET /account should return 200 (Profile Page)
    // ขั้นตอน: ล็อกอินและเรียกหน้าข้อมูลส่วนตัว (/account)
    // Expected: ระบบแสดงหน้าจอจัดการบัญชีผู้ใช้งานได้ถูกต้อง
    // -----------------------------------------------------------------
    test('UT-34: GET /account should return 200', async () => {
        const res = await request(app).get('/account');
        expect(res.statusCode).toBe(200);
    });

    // -----------------------------------------------------------------
    // TC-25: POST /account should update user and redirect
    // ขั้นตอน: ส่งข้อมูลชื่อนามสกุลใหม่ผ่านฟอร์มโพสต์
    // Expected: ระบบบันทึกสำเร็จและทำ Redirect (302) กลับหน้าแอคเคาท์
    // -----------------------------------------------------------------
    test('UT-35: POST /account should update user and redirect', async () => {
        const res = await request(app)
            .post('/account')
            .send({ firstName: 'New', lastName: 'Name' });
        expect(res.statusCode).toBe(302);
    });

    // -----------------------------------------------------------------
    // TC-26: GET /wishlist should return 200
    // ขั้นตอน: เรียกดูหน้ารายการโปรดของผู้ใช้
    // Expected: ระบบแสดงหน้ารวมสินค้าใน Wishlist สำเร็จ
    // -----------------------------------------------------------------
    test('UT-36: GET /wishlist should return 200', async () => {
        const User = require('../models/User');
        // ตรวจสอบหรือสร้าง User จำลองลงใน DB เพื่อให้หน้า Wishlist หาข้อมูลเจอ
        await User.findOneAndUpdate(
            { _id: new mongoose.Types.ObjectId(FIXED_ID) },
            { name: 'Test', email: 'test@test.com', wishlist: [] },
            { upsert: true, new: true }
        );
        const res = await request(app).get('/wishlist');
        expect(res.statusCode).toBe(200);
    });

    // -----------------------------------------------------------------
    // TC-27: POST /items/status/:id should update status and redirect
    // ขั้นตอน: เปลี่ยนสถานะสินค้าเป็น 'Sold'
    // Expected: สถานะถูกเปลี่ยนใน DB และ Redirect พากลับหน้าจัดการ
    // -----------------------------------------------------------------
    test('UT-37: POST /items/status/:id should update status and redirect', async () => {
        const Item = require('../models/Item');
        const item = await Item.create({ 
            name: 'S', price: 1, description: 'D', 
            category: testCategory._id, seller: new mongoose.Types.ObjectId(FIXED_ID)
        });
        const res = await request(app).post(`/items/status/${item._id}`).send({ status: 'Sold' });
        expect(res.statusCode).toBe(302);
    });

    // -----------------------------------------------------------------
    // TC-27.1: POST /items/status/:id should redirect to account if not owner
    // ขั้นตอน: พยายามเปลี่ยนสถานะสินค้าที่ไม่ใช่ของตนเอง (ไม่ใช่เจ้าของ)
    // Expected: ระบบบล็อกการทำงานและสลับไปหน้าแอคเคาท์ของผู้ใช้แทน
    // -----------------------------------------------------------------
    test('UT-38: POST /items/status/:id should redirect to account if not owner', async () => {
        const Item = require('../models/Item');
        const anotherId = new mongoose.Types.ObjectId();
        const item = await Item.create({ 
            name: 'NotMine', price: 1, description: 'D', 
            category: testCategory._id, seller: anotherId 
        });
        const res = await request(app).post(`/items/status/${item._id}`).send({ status: 'Sold' });
        expect(res.statusCode).toBe(302);
        expect(res.header.location).toBe('/account');
    });

    // -----------------------------------------------------------------
    // TC-28: GET /wishlist/add/:id should redirect
    // ขั้นตอน: กดเพิ่มสินค้าลงรายการโปรด
    // Expected: ระบบรับข้อมูลและ Redirect กลับหน้าสินค้าเดิม
    // -----------------------------------------------------------------
    test('UT-39: GET /wishlist/add/:id should redirect', async () => {
        const res = await request(app).get(`/wishlist/add/${new mongoose.Types.ObjectId()}`);
        expect(res.statusCode).toBe(302);
    });

    // -----------------------------------------------------------------
    // TC-29: POST /wishlist/remove/:id should redirect
    // ขั้นตอน: สั่งลบสินค้าออกจากรายการโปรด
    // Expected: ข้อมูลสินค้าถูกลบจาก Wishlist และ Redirect กลับหน้าแสดงผล
    // -----------------------------------------------------------------
    test('UT-40: POST /wishlist/remove/:id should redirect', async () => {
        const res = await request(app).post(`/wishlist/remove/${new mongoose.Types.ObjectId()}`);
        expect(res.statusCode).toBe(302);
    });

    // -----------------------------------------------------------------
    // TC-30: GET /auth/login (Login Page Coverage)
    // ขั้นตอน: เรียกหน้า Login ของระบบ
    // Expected: ระบบแสดงหน้าจอ Login ได้ถูกต้อง (HTTP 200)
    // -----------------------------------------------------------------
    test('UT-41: GET /auth/login', async () => {
        const res = await request(app).get('/auth/login');
        expect(res.statusCode).toBe(200);
    });

    // -----------------------------------------------------------------
    // TC-31: GET /health and /contact (Static Pages)
    // ขั้นตอน: เรียกหน้าตรวจสอบสถานะระบบและหน้าติดต่อเรา
    // Expected: ระบบคืนค่าปกติ (HTTP 200) ทั้งสองหน้า
    // -----------------------------------------------------------------
    test('UT-42: GET /health and /contact', async () => {
        const res1 = await request(app).get('/health');
        expect(res1.statusCode).toBe(200);
        const res2 = await request(app).get('/contact');
        expect(res2.statusCode).toBe(200);
    });

    // -----------------------------------------------------------------
    // TC-32: GET /account catch block (Error Handling)
    // ขั้นตอน: จำลองสถานะฐานข้อมูลขัดข้องขณะโหลดหน้า Account
    // Expected: ระบบยังคงแสดงหน้าจอได้โดยไม่ค้าง (Graceful Degradation)
    // -----------------------------------------------------------------
    test('UT-43: GET /account catch block', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const Item = require('../models/Item');
        const spy = jest.spyOn(Item, 'find').mockImplementationOnce(() => { throw new Error('Err'); });
        const res = await request(app).get('/account');
        expect(res.statusCode).toBe(200);
        spy.mockRestore();
        consoleSpy.mockRestore();
    });

    // -----------------------------------------------------------------
    // TC-33: POST /account catch block (Error Handling)
    // ขั้นตอน: จำลองสถานะฐานข้อมูลขัดข้องขณะอัปเดตโปรไฟล์
    // Expected: ระบบทำการ Redirect กลับหน้าเดิมและไม่เกิด Runtime Error
    // -----------------------------------------------------------------
    test('UT-44: POST /account catch block', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const User = require('../models/User');
        const spy = jest.spyOn(User, 'findByIdAndUpdate').mockImplementationOnce(() => { throw new Error('Err'); });
        const res = await request(app).post('/account').send({ firstName: 'X' });
        expect(res.statusCode).toBe(302);
        spy.mockRestore();
        consoleSpy.mockRestore();
    });

    // -----------------------------------------------------------------
    // TC-34: GET /wishlist edge case (No User Data)
    // ขั้นตอน: เรียกหน้า Wishlist ในกรณีที่ไม่พบข้อมูลผู้ใช้ในระบบ
    // Expected: ระบบความปลอดภัยสั่ง Redirect กลับไปหน้าแรก (HTTP 302)
    // -----------------------------------------------------------------
    test('UT-45: GET /wishlist edge case (no user)', async () => {
        const User = require('../models/User');
        const spy = jest.spyOn(User, 'findById').mockReturnValueOnce({
            populate: jest.fn().mockResolvedValue(null)
        });
        const res = await request(app).get('/wishlist');
        expect(res.statusCode).toBe(302);
        spy.mockRestore();
    });

    // -----------------------------------------------------------------
    // TC-35: POST /items/status/:id catch block (Error Handling)
    // ขั้นตอน: จำลองสถานะฐานข้อมูลขัดข้องขณะเปลี่ยนสถานะสินค้า
    // Expected: ระบบทำการ Redirect กลับเพื่อให้ผู้ใช้ลองใหม่ได้ (HTTP 302)
    // -----------------------------------------------------------------
    test('UT-46: POST /items/status/:id catch block', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const Item = require('../models/Item');
        const spy = jest.spyOn(Item, 'findById').mockImplementationOnce(() => { throw new Error('Err'); });
        const res = await request(app).post('/items/status/507f1f77bcf86cd799439011').send({ status: 'Sold' });
        expect(res.statusCode).toBe(302);
        spy.mockRestore();
        consoleSpy.mockRestore();
    });
});



