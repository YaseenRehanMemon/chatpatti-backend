const mongoose = require('mongoose');
const dotenv = require('dotenv');
const MenuItem = require('./models/MenuItem'); // Adjust path if necessary

// Load environment variables (specifically MONGODB_URI)
dotenv.config();

// --- Menu Item Data Removed ---
// The data below has already been seeded into the database.
// It has been removed from this script to keep the codebase clean.
// const menuItemsData = [ ... large array removed ... ];

const seedDatabase = async () => {
    console.log('Connecting to MongoDB for seeding check...');
    let connection;
    try {
        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/restaurantDB';
        if (!mongoUri) {
            console.error('Error: MONGODB_URI is not defined in your .env file.');
            process.exit(1);
        }
        connection = await mongoose.connect(mongoUri);
        console.log('MongoDB Connected.');

        // Optional: Check if data exists instead of just inserting blindly
        const count = await MenuItem.countDocuments();
        if (count > 0) {
            console.log(`Database already seeded with ${count} menu items. No action taken.`);
        } else {
            console.log('Database appears empty. Seeding data...');
            // --- Insertion logic commented out as data has been removed --- 
            // if (typeof menuItemsData !== 'undefined' && menuItemsData.length > 0) {
            //   const insertedItems = await MenuItem.insertMany(menuItemsData);
            //   console.log(`Successfully inserted ${insertedItems.length} menu items.`);
            // } else {
            //   console.log('No menu item data found in script to insert.');
            // }
            console.log('Initial seeding data was removed from this script after successful seeding.');
            console.log('If you need to re-seed, restore the data or provide a new data source.');
        }

        // Optional: Clear existing data (Uncomment carefully!)
        // await MenuItem.deleteMany({});
        // console.log('Existing menu items cleared.');

    } catch (error) {
        console.error('Error during seeding check/process:', error);
        process.exit(1);
    } finally {
        // Disconnect from MongoDB
        if (connection) {
        await mongoose.disconnect();
        console.log('MongoDB disconnected.');
    }
    }
};

// Run the seeding function/check
seedDatabase(); 