const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

module.exports = function (passport) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID || 'dummy-id',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'dummy-secret',
        callbackURL: '/auth/google/callback',
        proxy: true
    },
        async (accessToken, refreshToken, profile, done) => {
            const newUser = {
                googleId: profile.id,
                name: profile.displayName || profile.emails[0].value.split('@')[0],
                email: profile.emails[0].value,
                avatar: profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null
            };

            try {
                let user = await User.findOne({ googleId: profile.id });
                if (user) {
                    return done(null, user);
                } else {
                    user = await User.create(newUser);
                    return done(null, user);
                }
            } catch (err) {
                console.error("Passport Error:", err);
                return done(err, null);
            }
        }));

    passport.serializeUser((user, done) => done(null, user.id));
    passport.deserializeUser(async (id, done) => {
        try {
            const user = await User.findById(id).populate('wishlist');
            done(null, user);
        } catch (err) {
            done(err, null);
        }
    });
};