const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const itemController = require('../controllers/itemController');
const categoryController = require('../controllers/categoryController');
const authController = require('../controllers/authController');
const Item = require('../models/Item');
const Category = require('../models/Category');
const User = require('../models/User');

let mongod;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
});

afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongod.stop();
});

describe('Controller Unit Tests (UT-01 to UT-16)', () => {
    let mockReq, mockRes, mockNext;

    beforeEach(async () => {
        mockReq = {
            query: {},
            params: {},
            body: {},
            user: { _id: new mongoose.Types.ObjectId(), role: 'user' },
            session: {},
            logout: jest.fn((cb) => cb())
        };
        mockRes = {
            render: jest.fn(),
            send: jest.fn(),
            status: jest.fn().mockReturnThis(),
            redirect: jest.fn()
        };
        mockNext = jest.fn();
        
        await Item.deleteMany({});
        await Category.deleteMany({});
        await User.deleteMany({});
    });

    describe('Item Controller', () => {
        // -----------------------------------------------------------------
        // TC-11: getAllItems renders catalog with products
        // ขั้นตอน: สร้างสินค้า -> เรียกฟังก์ชัน getAllItems
        // Expected: ระบบเรียก res.render('catalog') พร้อมข้อมูลสินค้า
        // -----------------------------------------------------------------
        test('UT-01: getAllItems renders catalog with products', async () => {
            const cat = await Category.create({ name: 'Electronics' });
            await Item.create({ name: 'Phone', price: 100, description: 'desc', category: cat._id, seller: mockReq.user._id });
            
            await itemController.getAllItems(mockReq, mockRes);
            
            expect(mockRes.render).toHaveBeenCalledWith('catalog', expect.objectContaining({
                pageTitle: expect.any(String)
            }));
            expect(mockRes.render.mock.calls[0][1].products.length).toBe(1);
        });

        // -----------------------------------------------------------------
        // TC-11.2: getAllItems handles province and tags filter
        // ขั้นตอน: ส่ง query params (province, tags) -> เรียก getAllItems
        // Expected: ระบบทำงานสำเร็จและเรียกเรนเดอร์หน้าจอ
        // -----------------------------------------------------------------
        test('UT-02: getAllItems handles province and tags filter', async () => {
            mockReq.query = { province: 'Bangkok', tags: 'Tag1, Tag2' };
            await itemController.getAllItems(mockReq, mockRes);
            expect(mockRes.render).toHaveBeenCalled();
        });

        // -----------------------------------------------------------------
        // TC-11.3: getAllItems filters by keyword and price range
        // ขั้นตอน: ส่ง query (keyword, minPrice, maxPrice) -> เรียก getAllItems
        // Expected: ระบบส่งข้อมูลที่กรองแล้วไปยังหน้า catalog
        // -----------------------------------------------------------------
        test('UT-03: getAllItems filters by keyword and price range', async () => {
            mockReq.query = { keyword: 'iPhone', minPrice: '10000', maxPrice: '50000' };
            await itemController.getAllItems(mockReq, mockRes);
            expect(mockRes.render).toHaveBeenCalledWith('catalog', expect.any(Object));
        });

        // -----------------------------------------------------------------
        // TC-12: getItemById returns 404 if item not found
        // ขั้นตอน: ค้นหาสินค้าด้วยรหัสที่ไม่มีจริง
        // Expected: ระบบคืนค่า HTTP Status 404
        // -----------------------------------------------------------------
        test('UT-04: getItemById returns 404 if item not found', async () => {
            mockReq.params.id = new mongoose.Types.ObjectId();
            await itemController.getItemById(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(404);
        });

        // -----------------------------------------------------------------
        // TC-12.1: createItem saves a new item and redirects
        // ขั้นตอน: ส่งข้อมูลสินค้าใหม่ -> เรียก createItem
        // Expected: บันทึกลง DB สำเร็จและทำการ Redirect ไปหน้าแรก
        // -----------------------------------------------------------------
        test('UT-05: createItem saves a new item and redirects', async () => {
            const cat = await Category.create({ name: 'Test' });
            mockReq.body = { name: 'Item', price: 100, description: 'D', category: cat._id };
            mockReq.files = [];
            await itemController.createItem(mockReq, mockRes);
            expect(mockRes.redirect).toHaveBeenCalledWith('/');
        });

        // -----------------------------------------------------------------
        // TC-12.2: getAddItem renders selling page
        // ขั้นตอน: เรียกฟังก์ชัน getAddItem
        // Expected: ระบบแสดงหน้าจอแบบฟอร์มลงขายสินค้า
        // -----------------------------------------------------------------
        test('UT-06: getAddItem renders selling page', async () => {
            await Category.create({ name: 'Cat' });
            await itemController.getAddItem(mockReq, mockRes);
            expect(mockRes.render).toHaveBeenCalledWith('selling', expect.any(Object));
        });

        // -----------------------------------------------------------------
        // TC-12.3: deleteItem allows admin to delete anything
        // ขั้นตอน: ใช้สิทธิ์แอดมินลบสินค้าของผู้อื่น
        // Expected: ข้อมูลถูกลบสำเร็จและ Redirect กลับหน้าเดิม
        // -----------------------------------------------------------------
        test('UT-07: deleteItem allows admin to delete anything', async () => {
            mockReq.user.role = 'admin';
            const item = await Item.create({ name: 'AdminDelete', price: 1, description: 'D', category: new mongoose.Types.ObjectId(), seller: new mongoose.Types.ObjectId() });
            mockReq.params.id = item._id;
            await itemController.deleteItem(mockReq, mockRes);
            expect(mockRes.redirect).toHaveBeenCalledWith('back');
        });

        // -----------------------------------------------------------------
        // TC-12.4: deleteItem returns 403 if not owner and not admin
        // ขั้นตอน: ผู้ใช้ธรรมดาพยายามลบสินค้าของคนอื่น
        // Expected: ระบบส่งสถานะ 403 (Forbidden)
        // -----------------------------------------------------------------
        test('UT-08: deleteItem returns 403 if not owner and not admin', async () => {
            const item = await Item.create({ name: 'NotMine', price: 1, description: 'D', category: new mongoose.Types.ObjectId(), seller: new mongoose.Types.ObjectId() });
            mockReq.params.id = item._id;
            await itemController.deleteItem(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(403);
        });

        // -----------------------------------------------------------------
        // TC-12.5: createItem handles tags as string
        // ขั้นตอน: ส่งข้อมูลสินค้าพร้อม tags เป็น string ข้อมูลเดียว
        // Expected: ระบบแปลงเป็น array และบันทึกสำเร็จ
        // -----------------------------------------------------------------
        test('UT-09: createItem handles tags as string', async () => {
            mockReq.body = { 
                name: 'Item', 
                price: 10, 
                description: 'Valid Desc',
                category: new mongoose.Types.ObjectId(), 
                tags: 'SimpleTag',
                province: 'Bangkok'
            };
            await itemController.createItem(mockReq, mockRes);
            expect(mockRes.redirect).toHaveBeenCalledWith('/');
        });
    });

    describe('Category Controller', () => {
        // -----------------------------------------------------------------
        // TC-13: getAdminDashboard renders with category product counts
        // ขั้นตอน: เรียกหน้าแผงควบคุมแอดมิน
        // Expected: แสดงหน้า admin dashboard พร้อมข้อมูลสถิติ
        // -----------------------------------------------------------------
        test('UT-10: getAdminDashboard renders with category product counts', async () => {
            await Category.create({ name: 'Cat1' });
            await categoryController.getAdminDashboard(mockReq, mockRes);
            expect(mockRes.render).toHaveBeenCalledWith('admin', expect.any(Object));
        });

        // -----------------------------------------------------------------
        // TC-14: postAddCategory redirects to dashboard on success
        // ขั้นตอน: แอดมินกรอกชื่อหมวดหมู่ใหม่
        // Expected: บันทึกสำเร็จและพากลับเข้าหน้าแผงควบคุม
        // -----------------------------------------------------------------
        test('UT-11: postAddCategory redirects to dashboard on success', async () => {
            mockReq.body = { name: 'NewCat', description: 'D' };
            await categoryController.postAddCategory(mockReq, mockRes);
            expect(mockRes.redirect).toHaveBeenCalledWith('/admin/dashboard');
        });

        // -----------------------------------------------------------------
        // TC-14.2: postAddCategory redirects with error if duplicate name
        // ขั้นตอน: พยายามสร้างหมวดหมู่ที่ชื่อซ้ำกับที่มีอยู่แล้ว
        // Expected: ระบบ Redirect พร้อมแจ้ง error หมวดหมู่ซ้ำ
        // -----------------------------------------------------------------
        test('UT-12: postAddCategory redirects with error if duplicate name', async () => {
            await Category.create({ name: 'Exists' });
            mockReq.body = { name: 'Exists' };
            await categoryController.postAddCategory(mockReq, mockRes);
            expect(mockRes.redirect).toHaveBeenCalledWith(expect.stringContaining('error='));
        });

        // -----------------------------------------------------------------
        // TC-14.1: deleteCategory removes category and redirects
        // ขั้นตอน: แอดมินสั่งลบหมวดหมู่
        // Expected: ข้อมูลถูกลบจากฐานข้อมูลสำเร็จ
        // -----------------------------------------------------------------
        test('UT-13: deleteCategory removes category and redirects', async () => {
            const cat = await Category.create({ name: 'To Delete' });
            mockReq.params.id = cat._id;
            await categoryController.deleteCategory(mockReq, mockRes);
            expect(mockRes.redirect).toHaveBeenCalledWith('/admin/dashboard');
            const found = await Category.findById(cat._id);
            expect(found).toBeNull();
        });
    });

    describe('Auth Controller', () => {
        // -----------------------------------------------------------------
        // TC-15: postAdminLogin sets session and redirects
        // ขั้นตอน: กรอก username/password แอดมินที่ถูกต้อง
        // Expected: ระบบตั้งค่า Session isAdmin เป็น true และพาไป Dashboard
        // -----------------------------------------------------------------
        test('UT-14: postAdminLogin sets session and redirects', () => {
            mockReq.body = { username: 'admin', password: 'admin1234' };
            authController.postAdminLogin(mockReq, mockRes);
            expect(mockReq.session.isAdmin).toBe(true);
            expect(mockRes.redirect).toHaveBeenCalledWith('/categories/dashboard');
        });

        // -----------------------------------------------------------------
        // TC-16: postAdminLogin fails with wrong password
        // ขั้นตอน: กรอกรหัสผ่านแอดมินไม่ถูกต้อง
        // Expected: ไม่ผ่านการล็อกอินและพากลับไปหน้า Login
        // -----------------------------------------------------------------
        test('UT-15: postAdminLogin fails with wrong password', () => {
            mockReq.body = { username: 'wrong', password: 'wrong' };
            authController.postAdminLogin(mockReq, mockRes);
            expect(mockReq.session.isAdmin).toBeUndefined();
            expect(mockRes.redirect).toHaveBeenCalledWith('/login');
        });

        // -----------------------------------------------------------------
        // TC-17: logout destroys session and redirects
        // ขั้นตอน: เรียกคำสั่งออกจากระบบ
        // Expected: Session ถูกทำลายและ Redirect กลับหน้าแรก
        // -----------------------------------------------------------------
        test('UT-16: logout destroys session and redirects', () => {
            mockReq.logout = jest.fn((cb) => cb());
            mockReq.session.destroy = jest.fn();
            authController.logout(mockReq, mockRes);
            expect(mockReq.logout).toHaveBeenCalled();
            expect(mockRes.redirect).toHaveBeenCalledWith('/');
        });
    });
});
