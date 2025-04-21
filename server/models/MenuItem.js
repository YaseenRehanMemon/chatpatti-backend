const mongoose = require('mongoose');

const nutritionalInfoSchema = new mongoose.Schema({
  calories: Number,
  protein: Number,
  carbs: Number,
  fat: Number,
  allergens: [String],
}, { _id: false }); // No separate ID for nutritional info subdocument

const menuItemSchema = new mongoose.Schema({
  // We don't explicitly define _id, Mongoose handles it
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  image: { type: String, required: true }, // URL to the image
  category: {
    type: String,
    required: true,
    enum: ['main', 'appetizer', 'dessert', 'beverage', 'side'] // Add expected categories
  },
  vegetarian: { type: Boolean, default: false },
  spicyLevel: { type: Number, default: 1 }, // e.g., 1 (mild) to 5 (very spicy)
  popular: { type: Boolean, default: false },
  ingredients: { type: [String], default: [] },
  nutritionalInfo: nutritionalInfoSchema,
  available: { type: Boolean, default: true },
  preparationTime: { type: Number }, // Estimated time in minutes
}, { timestamps: true }); // Adds createdAt and updatedAt

const MenuItem = mongoose.model('MenuItem', menuItemSchema);

module.exports = MenuItem;
