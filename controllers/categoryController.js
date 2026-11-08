const Category = require('../models/Category');
const Item = require('../models/Item');

// Admin Dashboard (Show all products for management) 
exports.getAdminDashboard = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 30;
        const skip = (page - 1) * limit;

        // 1. Get all categories
        const categoriesData = await Category.find();
        
        // 2. Get total products count for pagination
        const totalProductsCount = await Item.countDocuments();
        const totalPages = Math.ceil(totalProductsCount / limit);

        // 3. Get products for the current page
        const products = await Item.find()
            .populate('seller')
            .populate('category')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        
        // 4. Map categories with counts (We need ALL products count per category, not just paginated ones)
        // For efficiency, we'll do an aggregation or a separate query if needed, 
        // but for now, let's just use the current approach with a small adjustment.
        const allProductsCountByCategory = await Item.aggregate([
            { $group: { _id: "$category", count: { $sum: 1 } } }
        ]);

        const categories = categoriesData.map(cat => {
            const catObj = cat.toObject();
            const found = allProductsCountByCategory.find(c => c._id && c._id.toString() === cat._id.toString());
            catObj.itemCount = found ? found.count : 0;
            return catObj;
        });
        
        res.render('admin', {
            categories,
            products,
            totalProductsCount,
            currentPage: page,
            totalPages,
            pageTitle: 'Admin Dashboard - Global2Hand'
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// Add Category 
exports.postAddCategory = async (req, res) => {
    try {
        const { name, description } = req.body;

        // Check if category already exists
        let category = await Category.findOne({ name });
        if (category) {
            return res.redirect('/admin/dashboard?error=หมวดหมู่นี้มีอยู่แล้ว');
        }

        const newCategory = new Category({ name, description });
        await newCategory.save();

        res.redirect('/admin/dashboard');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/dashboard?error=ไม่สามารถเพิ่มหมวดหมู่ได้');
    }
};

// Delete Category (Optional for admin management) 
exports.deleteCategory = async (req, res) => {
    try {
        await Category.findByIdAndDelete(req.params.id);
        res.redirect('/admin/dashboard');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/dashboard');
    }
};