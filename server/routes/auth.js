const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Adjust path to models
const { authenticateJWT } = require('../middleware/auth'); // Assuming middleware will be moved

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:8080'; // Use env var or default

// Helper for JWT token generation (can be moved to a utils file later)
const generateToken = (user) => {
    return jwt.sign(
        {
            id: user._id,
            email: user.email,
            role: user.role
        },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
};

// Google Auth Initiation
router.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email']
}));

// Google Auth Callback
router.get('/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: `${CLIENT_URL}/login?error=auth_failed` }), // Use CLIENT_URL
    (req, res) => {
        const token = generateToken(req.user);
        // Redirect to frontend callback URL with token
        res.redirect(`${CLIENT_URL}/auth/callback?token=${token}`);
    }
);

// Get Current User
router.get('/me', authenticateJWT, async (req, res) => {
    try {
        // req.user is populated by authenticateJWT middleware
        const user = await User.findById(req.user.id).select('-password -googleId'); // Exclude sensitive fields
        if (!user) {
            console.error('User not found for ID:', req.user.id);
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        res.json({ success: true, data: user });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch user profile' });
    }
});

// Logout (currently just a placeholder on backend for client-side token removal)
router.post('/logout', (req, res) => {
    // Client should remove the token
    res.json({ success: true, message: 'Logged out successfully' });
});

// Admin login route (for development/testing)
router.post('/admin-login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // In a real app, you would validate against hashed passwords in the database
        // This is just for development/testing
        if (email === 'admin@example.com' && password === 'admin123') {
            // Find or create admin user
            let adminUser = await User.findOne({ email });

            if (!adminUser) {
                adminUser = new User({
                    name: 'Admin User',
                    email,
                    role: 'admin'
                });
                await adminUser.save();
            } else if (adminUser.role !== 'admin') {
                adminUser.role = 'admin';
                await adminUser.save();
            }

            // Generate JWT token
            const token = generateToken(adminUser);

            res.json({
                success: true,
                data: {
                    token,
                    user: {
                        id: adminUser._id,
                        name: adminUser.name,
                        email: adminUser.email,
                        role: adminUser.role
                    }
                }
            });
        } else {
            res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

module.exports = router; 