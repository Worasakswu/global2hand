const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const passport = require('passport');
const session = require('express-session');
const methodOverride = require('method-override');
require('dotenv').config();

// Config and Passport
const connectDB = require('./config/db');
require('./config/passport')(passport);

// Import Models Early (Important for Mongoose Populates)
const User = require('./models/User');
const Item = require('./models/Item');
const Category = require('./models/Category');

// Start Express
const app = express();

// 1. Connect to MongoDB Atlas
connectDB();

// 2. Set Template Engine (EJS) 
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 3. Basic Middlewares
app.use(express.urlencoded({ extended: true })); // Read data from form
app.use(express.json()); // Read JSON data
app.use(methodOverride('_method')); // Enable form to send PUT/DELETE
app.use(express.static(path.join(__dirname, 'public'))); // Folder for CSS/JS/Images


// 4. Session
app.use(session({
    secret: process.env.SESSION_SECRET || 'global2hand_secret',
    resave: false,
    saveUninitialized: false
}));

// 5. Passport (Google Auth)
app.use(passport.initialize());
app.use(passport.session());

// 6. Set Global Variables
app.use(require('./middlewares/variables'));

// 7. Import Routes
app.use('/auth', require('./routes/auth'));
app.use('/items', require('./routes/items'));
app.use('/categories', require('./routes/categories'));

// Home Page (Use the same Controller as items)
const itemController = require('./controllers/itemController');
const { ensureAuth } = require('./middlewares/authMiddleware');

app.get('/', itemController.getHomePage);

// Health Check for Render/Deployment
app.get('/health', (req, res) => res.status(200).send('OK'));

// Static Pages Routes
app.get('/contact', (req, res) => res.render('contact', { pageTitle: 'Contact - Global2Hand' }));
app.get('/account', ensureAuth, async (req, res) => {
    try {
        const myProducts = await Item.find({ seller: req.user._id }).populate('category');
        res.render('account', {
            pageTitle: 'My Account - Global2Hand',
            products: myProducts || []
        });
    } catch (err) {
        console.error('Account page error:', err);
        res.render('account', { pageTitle: 'My Account - Global2Hand', products: [] });
    }
});
app.post('/account', ensureAuth, async (req, res) => {
    try {
        const User = require('./models/User');
        const { firstName, lastName, address, province } = req.body;
        const userId = req.user ? req.user._id : null;
        if (!userId) {
            return res.redirect('/account');
        }
        await User.findByIdAndUpdate(userId, {
            firstName: firstName || '',
            lastName: lastName || '',
            name: [firstName, lastName].filter(Boolean).join(' ') || req.user.name,
            address: address || '',
            province: province || ''
        });
        res.redirect('/account');
    } catch (err) {
        console.error('Account update error:', err);
        res.redirect('/account');
    }
});
// 7.5 Wishlist Routes
console.log('Mounting Wishlist Routes...');
app.get('/wishlist', ensureAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const skip = (page - 1) * limit;

        const user = await User.findById(req.user._id).populate('wishlist');
        if (!user) return res.redirect('/');

        // 1. ค้นหาสินค้าที่มีอยู่จริงจาก ID ใน Wishlist (ดักจับกรณี wishlist เป็น undefined)
        const wishlistIds = user.wishlist || [];
        const allExistingItems = await Item.find({ _id: { $in: wishlistIds } }).select('_id');
        const existingIds = allExistingItems.map(item => item._id.toString());

        // 2. ถ้าจำนวนไม่ตรงกัน แสดงว่ามีสินค้าถูกลบไปแล้ว ให้ Update ข้อมูล User เพื่อล้างขยะ
        if (wishlistIds.length !== existingIds.length) {
            user.wishlist = wishlistIds.filter(id => id && existingIds.includes(id.toString()));
            await user.save();
        }

        const totalItems = existingIds.length;
        const totalPages = Math.ceil(totalItems / limit);

        // 3. ดึงสินค้าที่จะแสดงในหน้านั้นๆ
        const products = await Item.find({ _id: { $in: existingIds } })
            .populate('category')
            .populate('seller')
            .skip(skip)
            .limit(limit);

        res.render('wishlist', {
            pageTitle: 'Wishlist - Global2Hand',
            products: products || [],
            user: user,
            totalItems: totalItems,
            currentPage: page,
            totalPages: totalPages
        });
    } catch (err) {
        console.error('Wishlist error:', err);
        res.redirect('/');
    }
});

app.get('/wishlist/add/:id', ensureAuth, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user._id, {
            $addToSet: { wishlist: req.params.id }
        });
        
        if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
            return res.json({ success: true, message: 'Added to wishlist' });
        }
        res.redirect('back');
    } catch (err) {
        console.error('Wishlist Add error:', err);
        if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
            return res.status(500).json({ success: false, message: 'Server Error' });
        }
        res.redirect('back');
    }
});

app.post('/wishlist/remove/:id', ensureAuth, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user._id, {
            $pull: { wishlist: req.params.id }
        });
        res.redirect('/wishlist');
    } catch (err) {
        res.redirect('/wishlist');
    }
});

// Item Status Update (Sold Out)
app.post('/items/status/:id', ensureAuth, async (req, res) => {
    try {
        const Item = require('./models/Item');
        const { status } = req.body;
        // Verify ownership
        const item = await Item.findById(req.params.id);
        if (!item || item.seller.toString() !== req.user._id.toString()) {
            return res.redirect('/account');
        }
        await Item.findByIdAndUpdate(req.params.id, { status: status || 'Sold' });
        res.redirect('/account');
    } catch (err) {
        console.error('Status update error:', err);
        res.redirect('/account');
    }
});

// Set Port and Start Server
const PORT = process.env.PORT || 10000; // Default to 10000 for Render
if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

module.exports = app;