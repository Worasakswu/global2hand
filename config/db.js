const mongoose = require('mongoose');

const Category = require('../models/Category');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Atlas Connected....');

        // Automatic Seeding for Categories
        const count = await Category.countDocuments();
        if (count === 0) {
            console.log('No categories found. Seeding default categories...');
            const defaultCategories = [
                { name: "แฟชั่นผู้หญิง (Woman's Fashion)" },
                { name: "แฟชั่นผู้ชาย (Men's Fashion)" },
                { name: "อิเล็กทรอนิกส์ (Electronics)" },
                { name: "บ้านและไลฟ์สไตล์ (Home & Lifestyle)" },
                { name: "ยาและเวชภัณฑ์ (Medicine)" },
                { name: "กีฬาและกิจกรรมกลางแจ้ง (Sports & Outdoor)" },
                { name: "แม่และเด็ก / ของเล่น (Baby's & Toys)" },
                { name: "ของกินและสัตว์เลี้ยง (Groceries & Pets)" },
                { name: "สุขภาพและความงาม (Health & Beauty)" }
            ];
            await Category.insertMany(defaultCategories);
            console.log('Default categories seeded successfully!');
        }
    } catch (err) {
        console.error('MongoDB Connection Error:', err.message);
        process.exit(1);
    }
};

module.exports = connectDB;