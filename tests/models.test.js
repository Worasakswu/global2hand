/**
 * Unit Tests — Global2Hand Models
 * ทดสอบ Data Structure ของ Models (User, Category, Item)
 * จำนวนทั้งหมด: 10 Test Cases
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

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

afterEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany({});
    }
});

const User = require('../models/User');
const Category = require('../models/Category');
const Item = require('../models/Item');

describe('Data Structure Unit Tests (UT-23 to UT-32)', () => {

    // -----------------------------------------------------------------
    // UT-23: (User) สร้าง User ที่ถูกต้องและบันทึกลงฐานข้อมูลได้
    // ขั้นตอน: กำหนดข้อมูล User -> สั่งบันทึกลงฐานข้อมูล
    // Expected: ข้อมูลถูกบันทึกสำเร็จและมี _id เกิดขึ้นจริง
    // -----------------------------------------------------------------
    test('UT-23: (User) สร้าง User ที่ถูกต้องและบันทึกลงฐานข้อมูลได้', async () => {
        const userData = { name: 'Krittin', email: 'test@test.com' };
        const user = new User(userData);
        const savedUser = await user.save();
        expect(savedUser._id).toBeDefined();
        expect(savedUser.name).toBe(userData.name);
    });

    // -----------------------------------------------------------------
    // UT-24: (User) ต้อง Error หากไม่มี email (Required Field)
    // ขั้นตอน: กำหนดข้อมูล User โดยเว้น email ให้เป็นค่าว่าง -> สั่งบันทึก
    // Expected: Mongoose ต้องขว้าง Validation Error กลับมา
    // -----------------------------------------------------------------
    test('UT-24: (User) ต้อง Error หากไม่มี email (Required Field)', async () => {
        const userData = { name: 'Krittin' };
        const user = new User(userData);
        let err;
        try {
            await user.save();
        } catch (error) {
            err = error;
        }
        expect(err).toBeDefined();
    });

    // -----------------------------------------------------------------
    // UT-25: (User) ไม่สามารถใช้ email ซ้ำกันได้ (Unique Constraint)
    // ขั้นตอน: สร้าง User ที่ 1 -> พยายามสร้าง User ที่ 2 ด้วย email เดิม
    // Expected: ฐานข้อมูลต้อง Error เรื่อง Unique Constraint
    // -----------------------------------------------------------------
    test('UT-25: (User) ไม่สามารถใช้ email ซ้ำกันได้ (Unique Constraint)', async () => {
        await User.syncIndexes(); // บังคับสร้าง unique index ใน in-memory DB
        await User.create({ name: 'User1', email: 'unique@test.com' });
        let err;
        try {
            await User.create({ name: 'User2', email: 'unique@test.com' });
        } catch (error) {
            err = error;
        }
        expect(err).toBeDefined();
    });

    // -----------------------------------------------------------------
    // UT-26: (Category) สร้าง Category ใหม่ได้สำเร็จ
    // ขั้นตอน: กำหนดชื่อหมวดหมู่ -> สั่งบันทึก
    // Expected: ชื่อหมวดหมู่ต้องถูกจัดเก็บอย่างถูกต้อง
    // -----------------------------------------------------------------
    test('UT-26: (Category) สร้าง Category ใหม่ได้สำเร็จ', async () => {
        const cat = new Category({ name: 'Electronics' });
        const savedCat = await cat.save();
        expect(savedCat.name).toBe('Electronics');
    });

    // -----------------------------------------------------------------
    // UT-27: (Category) ต้อง Error หากไม่มีชื่อ Category
    // ขั้นตอน: สร้าง Category โดยไม่ระบุชื่อ -> สั่งบันทึก
    // Expected: ระบบแจ้ง Error (Validation)
    // -----------------------------------------------------------------
    test('UT-27: (Category) ต้อง Error หากไม่มีชื่อ Category', async () => {
        const cat = new Category({});
        let err;
        try {
            await cat.save();
        } catch (error) {
            err = error;
        }
        expect(err).toBeDefined();
    });

    // -----------------------------------------------------------------
    // UT-28: (Item) สร้าง Item ใหม่พร้อมระบุข้อมูลแนบครบถ้วน
    // ขั้นตอน: กำหนดชื่อ ราคา และระบุ seller/category -> สั่งบันทึก
    // Expected: ข้อมูลสินค้าและรหัสอ้างอิง (Relationship) ต้องบันทึกเรียบร้อย
    // -----------------------------------------------------------------
    test('UT-28: (Item) สร้าง Item ใหม่พร้อมระบุข้อมูลครบได้', async () => {
        const item = new Item({
            name: 'iPhone 15',
            price: 35000,
            description: 'Good condition',
            seller: new mongoose.Types.ObjectId(),
            category: new mongoose.Types.ObjectId()
        });
        const savedItem = await item.save();
        expect(savedItem.name).toBe('iPhone 15');
    });

    // -----------------------------------------------------------------
    // UT-29: (Item) ต้อง Error หากไม่ใส่ราคา
    // ขั้นตอน: สร้าง Item โดยไม่ระบุราคา -> สั่งบันทึก
    // Expected: ระบบปฏิเสธการเซฟและแจ้ง Validation Error
    // -----------------------------------------------------------------
    test('UT-29: (Item) ต้อง Error หากไม่ใส่ราคา', async () => {
        const item = new Item({ name: 'No Price', description: 'Desc' });
        let err;
        try {
            await item.save();
        } catch (error) {
            err = error;
        }
        expect(err).toBeDefined();
    });

    // -----------------------------------------------------------------
    // UT-30: (Item) ต้อง Error หากใส่ status ที่ไม่อยู่ในรายการกำหนด
    // ขั้นตอน: สร้าง Item พร้อมระบุสถานะเป็น 'Invalid' -> สั่งบันทึก
    // Expected: Mongoose Enum Validation ต้องแจ้ง Error
    // -----------------------------------------------------------------
    test('UT-30: (Item) ต้อง Error หากใส่ status ที่ไม่อยู่ในรายการกำหนด', async () => {
        const item = new Item({ name: 'X', price: 10, status: 'InvalidStatus' });
        let err;
        try {
            await item.save();
        } catch (error) {
            err = error;
        }
        expect(err).toBeDefined();
    });

    // -----------------------------------------------------------------
    // UT-31: (Item) สามารถบันทึก tags เป็น Array ของ String ได้
    // ขั้นตอน: ระบุค่า tags เป็น ["tag1", "tag2"] -> สั่งบันทึก
    // Expected: ข้อมูลต้องถูกเก็บเป็น Array และคงค่าเดิมไว้ได้
    // -----------------------------------------------------------------
    test('UT-31: (Item) สามารถบันทึก tags เป็น Array ของ String ได้', async () => {
        const seller = await User.create({ name: 'S3', email: 's3@test.com' });
        const cat = await Category.create({ name: 'C3' });
        const item = await Item.create({
            name: 'Tagged', price: 50, description: 'x',
            category: cat._id, seller: seller._id,
            tags: ['tag1', 'tag2']
        });
        expect(Array.isArray(item.tags)).toBe(true);
        expect(item.tags).toContain('tag1');
    });

    // -----------------------------------------------------------------
    // UT-32: (Item) ข้อมูลต้องมี timestamps อัตโนมัติ
    // ขั้นตอน: สั่งบันทึกสินค้าชุดใหม่
    // Expected: ฟิลด์ createdAt และ updatedAt ต้องถูกเจนเนอเรตให้อัตโนมัติ
    // -----------------------------------------------------------------
    test('UT-32: (Item) ข้อมูลต้องมี timestamps (createdAt, updatedAt) อัตโนมัติ', async () => {
        const seller = await User.create({ name: 'S4', email: 's4@test.com' });
        const cat = await Category.create({ name: 'C4' });
        const item = await Item.create({
            name: 'TimeTest', price: 10, description: 'x',
            category: cat._id, seller: seller._id
        });
        expect(item.createdAt).toBeDefined();
        expect(item.updatedAt).toBeDefined();
    });

});
