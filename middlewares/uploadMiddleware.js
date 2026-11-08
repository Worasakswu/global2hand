const upload = require('../config/cloudinary');

// Middleware that handles "capturing 1 image file" from a form with the field name 'image'
module.exports = upload.single('image');