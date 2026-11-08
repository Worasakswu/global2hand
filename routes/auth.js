const express = require('express');
const router = express.Router();
const passport = require('passport');
const authController = require('../controllers/authController');

// Login page
router.get('/login', authController.getLogin);

// Sign Up page
router.get('/signup', authController.getSignup);

// Google Login
router.get('/google', passport.authenticate('google', { 
    scope: ['profile', 'email'],
    prompt: 'select_account'
}));

// Google Callback
router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/auth/login' }),
    (req, res) => res.redirect('/')
);

router.post('/admin-login', authController.postAdminLogin);

router.get('/logout', authController.logout);

module.exports = router;