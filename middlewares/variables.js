module.exports = (req, res, next) => {
    // Send user and isAdmin variables to every .ejs file
    res.locals.user = req.user || null;
    res.locals.isAdmin = req.session.isAdmin || false;
    next();
};