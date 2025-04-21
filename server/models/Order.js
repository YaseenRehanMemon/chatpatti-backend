
const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [
    {
      menuItem: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MenuItem',
        required: true
      },
      quantity: {
        type: Number,
        required: true,
        min: 1
      },
      specialInstructions: String,
      price: {
        type: Number,
        required: true
      }
    }
  ],
  status: {
    type: String,
    enum: ['pending', 'preparing', 'ready', 'delivered', 'cancelled'],
    default: 'pending'
  },
  totalAmount: {
    type: Number,
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'cash'],
    required: true
  },
  deliveryAddress: {
    street: String,
    city: String,
    state: String,
    postalCode: String,
    country: String
  },
  contactPhone: {
    type: String,
    required: true
  },
  orderType: {
    type: String,
    enum: ['delivery', 'pickup'],
    required: true
  },
  specialInstructions: String,
  estimatedDeliveryTime: Date,
  orderDate: {
    type: Date,
    default: Date.now
  },
  deliveryFee: Number,
  tax: Number,
  tip: Number,
  stripePaymentIntentId: String
}, { timestamps: true });

module.exports = mongoose.model('Order', OrderSchema);
