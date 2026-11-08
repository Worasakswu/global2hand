module.exports = {
    // Check if User logged in via Google
    ensureAuth: function (req, res, next) {
        if (req.isAuthenticated()) {
            return next();
        }
        res.redirect('/auth/login');
    },
    // Check if Admin (Hardcode)
    ensureAdmin: function (req, res, next) {
        if (req.session.isAdmin) {
            return next();
        }
        res.status(403).send('Access Denied: Admin Only');
    }
};