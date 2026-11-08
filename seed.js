const mongoose = require('mongoose');
const Category = require('./models/Category');
require('dotenv').config();

const categories = [
    { name: 'Fashion' },
    { name: 'Music' },
    { name: 'Electronics' },
    { name: 'Home & Lifestyle' },
    { name: 'Bicycles' },
    { name: 'Sports' },
    { name: 'Baby\'s & Toys' },
    { name: 'Pets' },
    { name: 'Collection' }
];

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/global2hand')
    .then(async () => {
        console.log('Clearing old categories...');
        await Category.deleteMany({}); // Delete all old categories
        
        console.log('Inserting new categories...');
        for (let cat of categories) {
            await Category.create(cat);
        }
        console.log('All categories inserted successfully!');
        process.exit();
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
