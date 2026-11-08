const cloudinary = require('cloudinary');
const CloudinaryStorage = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = CloudinaryStorage({
    cloudinary: cloudinary,
    folder: 'Global2Hand_Products',
    allowedFormats: ['jpg', 'png', 'jpeg']
});

const upload = multer({ storage: storage });

// Export single 'upload' instance (no object braces needed)
module.exports = upload;