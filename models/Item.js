const mongoose = require('mongoose');

const ItemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    description: { type: String, required: true },
    images: [{ type: String }],  // Store multiple URLs from Cloudinary
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    tags: [{ type: String }],  // Array of labels/tags
    province: { type: String }, // NEW: Store province directly for search
    phone: { type: String }, // Store seller's contact number
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['Available', 'Sold'], default: 'Available' },
    isRecommended: { type: Boolean, default: false } // Featured product (20 THB boost)
}, { timestamps: true });

module.exports = mongoose.model('Item', ItemSchema);