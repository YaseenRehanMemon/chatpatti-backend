const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const http = require('http');

// Load environment variables
dotenv.config();

// Initialize Stripe (needed here if used globally or by multiple routes directly)
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Connect to MongoDB with serverless-friendly approach
let cachedDb = null;
const connectToDatabase = async () => {
  if (cachedDb) {
    return cachedDb;
  }

  try {
    const connection = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/restaurantDB');
    console.log('Connected to MongoDB');
    cachedDb = connection;
    return connection;
  } catch (err) {
    console.error('MongoDB connection error:', err);
    throw err;
  }
};

// Connect immediately for serverless
connectToDatabase();

// Import models (potentially needed by middleware or configuration)
const User = require('./models/User');
// Removed MenuItem require, handled in routes
// Removed Order require, handled in routes

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:8080';
const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:4001';
const ADMIN_URL_DEV = process.env.NODE_ENV === 'production' ? null : 'http://localhost:4000';
const VERCEL_FRONTEND_URL = 'https://chatpatti.vercel.app';

// Create HTTP server - only used in dev environment
const server = http.createServer(app);

// --- Middleware ---
app.use(cors({
  origin: [CLIENT_URL, ADMIN_URL, ADMIN_URL_DEV, VERCEL_FRONTEND_URL].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
// Special middleware for Stripe webhook BEFORE express.json()
// We need the raw body for signature verification
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json()); // For parsing application/json
app.use(cookieParser());
app.use(passport.initialize());

// JWT Secret (Needed for Passport config)
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret';

// Configure Passport Google Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  // Ensure callback URL matches the one registered in Google Cloud Console
  callbackURL: `/api/auth/google/callback` // Relative path is usually fine if proxying
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ email: profile.emails[0].value });
    if (!user) {
      user = new User({
        name: profile.displayName,
        email: profile.emails[0].value,
        image: profile.photos[0]?.value,
        googleId: profile.id, // Store googleId
        role: 'user'
      });
      await user.save();
    } else {
      // Optionally update fields if they signed in with Google again
      if (!user.googleId) user.googleId = profile.id;
      if (profile.displayName) user.name = profile.displayName;
      if (profile.photos?.[0]?.value) user.image = profile.photos[0].value;
      await user.save();
    }
    return done(null, user); // Pass the user object to be serialized or used
  } catch (error) {
    return done(error, false);
  }
}));

// --- Import Routers ---
const authRoutes = require('./routes/auth');
const menuItemsRoutes = require('./routes/menuItems');
const orderRoutes = require('./routes/orders');
const userRoutes = require('./routes/users');
const paymentRoutes = require('./routes/payments');
const adminRoutes = require('./routes/admin');
const contactRoutes = require('./routes/contact');

// --- Mount Routers ---
app.use('/api/auth', authRoutes);
app.use('/api/menu-items', menuItemsRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/contact', contactRoutes);

// Root route - API documentation
app.get('/', (req, res) => {
  // Get base URL for documentation
  const baseUrl = process.env.NODE_ENV === 'production'
    ? 'https://chatpati-backend.vercel.app'
    : `http://localhost:${PORT}`;

  res.json({
    name: 'Plate to Pixel Eatery API',
    version: '1.0.0',
    description: 'Backend API for the Plate to Pixel Eatery restaurant application',

    endpoints: {
      auth: [
        { method: 'GET', url: `${baseUrl}/api/auth/google`, description: 'Initiate Google OAuth authentication', authRequired: false },
        { method: 'GET', url: `${baseUrl}/api/auth/google/callback`, description: 'Google OAuth callback', authRequired: false },
        { method: 'GET', url: `${baseUrl}/api/auth/me`, description: 'Get current authenticated user', authRequired: true },
        { method: 'POST', url: `${baseUrl}/api/auth/logout`, description: 'Log out user (clears token)', authRequired: false }
      ],

      menuItems: [
        { method: 'GET', url: `${baseUrl}/api/menu-items`, description: 'Get all available menu items', authRequired: false },
        { method: 'GET', url: `${baseUrl}/api/menu-items/:id`, description: 'Get a specific menu item (replace :id)', authRequired: false },
        { method: 'POST', url: `${baseUrl}/api/menu-items`, description: 'Create a new menu item', authRequired: 'admin' },
        { method: 'PUT', url: `${baseUrl}/api/menu-items/:id`, description: 'Update a menu item (replace :id)', authRequired: 'admin' },
        { method: 'DELETE', url: `${baseUrl}/api/menu-items/:id`, description: 'Delete a menu item (replace :id)', authRequired: 'admin' }
      ],

      orders: [
        { method: 'GET', url: `${baseUrl}/api/orders`, description: 'Get orders (admin: all, user: own)', authRequired: true },
        { method: 'GET', url: `${baseUrl}/api/orders/:id`, description: 'Get a specific order (replace :id)', authRequired: 'owner/admin' },
        { method: 'POST', url: `${baseUrl}/api/orders`, description: 'Create a new order', authRequired: true },
        { method: 'PUT', url: `${baseUrl}/api/orders/:id/status`, description: 'Update order status (replace :id)', authRequired: 'admin' },
        { method: 'POST', url: `${baseUrl}/api/orders/:id/cancel`, description: 'Cancel an order (replace :id)', authRequired: 'owner/admin' }
      ],

      users: [
        { method: 'PUT', url: `${baseUrl}/api/users/profile`, description: 'Update user profile', authRequired: true }
      ],

      payments: [
        { method: 'POST', url: `${baseUrl}/api/payments/create-checkout-session`, description: 'Create Stripe checkout session', authRequired: true },
        { method: 'POST', url: `${baseUrl}/api/payments/create-payment-intent`, description: 'Create Stripe payment intent', authRequired: true },
        { method: 'POST', url: `${baseUrl}/api/payments/webhook`, description: 'Stripe webhook endpoint', authRequired: 'stripe-signature' }
      ],

      contact: [
        { method: 'POST', url: `${baseUrl}/api/contact`, description: 'Submit a contact form', authRequired: false },
        { method: 'GET', url: `${baseUrl}/api/contact`, description: 'Get all contact messages', authRequired: 'admin' },
        { method: 'GET', url: `${baseUrl}/api/contact/:id`, description: 'Get a specific contact message', authRequired: 'admin' },
        { method: 'PUT', url: `${baseUrl}/api/contact/:id/status`, description: 'Update message status', authRequired: 'admin' },
        { method: 'DELETE', url: `${baseUrl}/api/contact/:id`, description: 'Delete a contact message', authRequired: 'admin' }
      ]
    },

    note: "This API reference can be used with tools like Postman, Insomnia, or curl to test endpoints."
  });
});

// Enhanced error handling middleware for better debugging
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'production' ? null : err.message
  });
});

// Start server in development only - Vercel handles this in production
if (process.env.NODE_ENV !== 'production') {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Export for Vercel serverless functions
module.exports = app;
