const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    googleId: { type: String },
    name:      { type: String, required: true },
    firstName: { type: String },
    lastName:  { type: String },
    email:     { type: String, required: true, unique: true },
    avatar:   { type: String },
    address:  { type: String },
    province: { type: String },
    role:     { type: String, enum: ['user', 'admin'], default: 'user' },
    isVerified: { type: Boolean, default: false },
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Item' }]
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
