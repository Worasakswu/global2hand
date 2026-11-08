const express = require('express');
const router = express.Router();
const itemController = require('../controllers/itemController');

// 1. Import authentication middleware to check login status
const { ensureAuth } = require('../middlewares/authMiddleware');

// 2. Import image upload middleware (must match the export in step 1)
const upload = require('../config/cloudinary');

// 3. Use (ensure the 'upload' variable name matches)
router.get('/', itemController.getAllItems);
router.get('/add', ensureAuth, itemController.getAddItem);
router.post('/add', ensureAuth, (req, res, next) => {
    upload.any()(req, res, (err) => {
        if (err) {
            console.error('Multer Error:', err);
            return res.status(400).send(`
                <h1>Upload Error</h1>
                <p>${err.message || 'Only .jpg, .jpeg, .png formats are allowed!'}</p>
                <a href="/items/add">Back to Upload</a>
            `);
        }
        next();
    });
}, itemController.createItem);
router.get('/:id', itemController.getItemById);
router.delete('/:id', ensureAuth, itemController.deleteItem);

module.exports = router;