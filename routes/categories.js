const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
// @ts-ignore
const { ensureAdmin } = require('../middlewares/authMiddleware');

// Admin Dashboard (Admin Only)
router.get('/dashboard', ensureAdmin, categoryController.getAdminDashboard);

// Add Category (Admin Only)
router.post('/add', ensureAdmin, categoryController.postAddCategory);

// Delete Category (Admin Only)
router.post('/delete/:id', ensureAdmin, categoryController.deleteCategory);

module.exports = router;