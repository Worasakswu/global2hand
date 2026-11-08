const Item = require('../models/Item');
const Category = require('../models/Category');

// Display Home Page
exports.getHomePage = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 12; 
        const skip = (page - 1) * limit;

        // 1. Fetch ALL Recommended (Boosted) products separately
        const recommendedProducts = await Item.find({ 
            status: 'Available', 
            isRecommended: true 
        }).populate('seller').populate('category').sort({ createdAt: -1 });

        // 2. Fetch Paginated products for "All Products" section
        const totalItems = await Item.countDocuments({ status: 'Available' });
        const items = await Item.find({ status: 'Available' })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('seller')
            .populate('category');

        const categories = await Category.find();
        
        res.render('home', {
            recommendedProducts, // Pass boosted products separately
            products: items,
            categories,
            query: req.query,
            pageTitle: 'Global2Hand - Home',
            currentPage: page,
            totalPages: Math.ceil(totalItems / limit)
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

//  Display all items , Search (Search/Filter) for Catalog Page
exports.getAllItems = async (req, res) => {
    try {
        let { keyword, category, minPrice, maxPrice, province, tags, page } = req.query;
        const currentPage = parseInt(page) || 1;
        const limit = 20; // 20 items per page as requested
        const skip = (currentPage - 1) * limit;

        if (keyword) keyword = keyword.trim();
        let query = { status: 'Available' };

        if (keyword) {
            query.$or = [
                { name: { $regex: keyword, $options: 'i' } },
                { description: { $regex: keyword, $options: 'i' } },
                { tags: { $regex: keyword, $options: 'i' } }
            ];
        }
        if (category) query.category = category;
        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = Number(minPrice);
            if (maxPrice) query.price.$lte = Number(maxPrice);
        }
        if (tags) query.tags = { $in: tags.split(',').map(t => t.trim()) };
        if (province) query.province = province;

        const totalItems = await Item.countDocuments(query);
        let items = await Item.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('seller')
            .populate('category');

        const categories = await Category.find();
        res.render('catalog', {
            products: items,
            categories,
            query: req.query,
            pageTitle: 'Global2Hand - Catalog',
            currentPage,
            totalPages: Math.ceil(totalItems / limit)
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// Add item form 
exports.getAddItem = async (req, res) => {
    try {
        const categories = await Category.find();
        res.render('selling', { categories, pageTitle: 'Add Item' });
    } catch (err) {
        console.error('Error loading Selling page:', err);
        res.status(500).send(`
            <h1>Internal Server Error</h1>
            <p>ระบบมีปัญหาในการโหลดหน้าลงขายสินค้า (ไม่สามารถดึงหมวดหมู่ได้)</p>
            <p>Error: ${err.message}</p>
            <a href="/">กลับไปหน้าแรก</a>
        `);
    }
};

//  Save new item (with image upload to Cloudinary) 
exports.createItem = async (req, res) => {
    try {
        const { name, price, description, category, tags, province, phone, isRecommended } = req.body;
        const newItem = new Item({
            name,
            price,
            description,
            category,
            tags: Array.isArray(tags) ? tags : (tags ? [tags] : []), // Handle Checkbox Array or String
            province,
            phone,
            isRecommended: isRecommended === 'true', // Handle checkbox value
            images: req.files ? req.files.map(f => f.path || f.url || f.secure_url) : [], // Handle multiple uploads
            seller: req.user._id // ID from Google Login
        });
        await newItem.save();
        res.redirect('/');
    } catch (err) {
        console.error(err);
        res.status(400).send(`
            <h1>Failed to add product</h1>
            <pre>${err.message}</pre>
            <a href="/items/add">Go back and try again</a>
        `);
    }
};

// Get single item detail
exports.getItemById = async (req, res) => {
    try {
        const item = await Item.findById(req.params.id).populate('seller').populate('category');
        if (!item) return res.status(404).send('Item not found');
        
        res.render('product', { product: item, pageTitle: item.name });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

//  Delete item (Only owner can delete) 
exports.deleteItem = async (req, res) => {
    try {
        const item = await Item.findById(req.params.id);
        if (!item) return res.status(404).send('Item not found');

        // Check ownership OR Check Admin role
        if (item.seller.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).send('คุณไม่มีสิทธิ์ลบสินค้านี้ (Not authorized)');
        }

        await Item.findByIdAndDelete(req.params.id);
        res.redirect('back');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};