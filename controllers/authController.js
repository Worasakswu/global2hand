const User = require('../models/User');

//  Login page 
exports.getLogin = (req, res) => {
    res.render('login', { pageTitle: 'Login - Global2Hand' });
};

// Sign Up page
exports.getSignup = (req, res) => {
    res.render('signup', { pageTitle: 'Sign Up - Global2Hand' });
};

// Admin Login (Hardcode) 
exports.postAdminLogin = (req, res) => {
    const { username, password } = req.body;
    // Hardcode
    if (username === 'admin' && password === 'admin1234') {
        req.session.isAdmin = true;
        req.session.user = { username: 'Admin System', role: 'admin' };
        return res.redirect('/categories/dashboard');
    }
    res.redirect('/login');  // If wrong, go back to Login page
};

// Logout 
exports.logout = (req, res) => {
    req.logout(() => {
        req.session.destroy();
        res.redirect('/');
    });
};