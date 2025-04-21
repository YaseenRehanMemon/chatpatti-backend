const express = require('express');
const User = require('../models/User');
const { authenticateJWT, isAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all users (admin only)
router.get('/', authenticateJWT, isAdmin, async (req, res) => {
    try {
        const users = await User.find({})
            .select('-password -googleId -__v')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            data: users,
            message: 'Users retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ success: false, error: 'Server error fetching users' });
    }
});

// Get current user
router.get('/me', authenticateJWT, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password -googleId -__v');
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        res.json({
            success: true,
            data: user,
            message: 'User retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ success: false, error: 'Server error fetching user profile' });
    }
});

// Update User Profile
router.put('/profile', authenticateJWT, async (req, res) => {
    try {
        const { name, phone, address } = req.body;

        // Find user by ID from the JWT payload
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Update fields if they are provided in the request body
        if (name !== undefined) user.name = name;
        if (phone !== undefined) user.phone = phone;
        if (address !== undefined) user.address = address; // Assuming address is an object

        const updatedUser = await user.save();

        // Select fields to return (exclude sensitive data)
        const userToReturn = await User.findById(updatedUser._id).select('-password -googleId -__v');

        res.json({
            success: true,
            data: userToReturn,
            message: 'Profile updated successfully'
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ success: false, error: error.message });
        }
        res.status(500).json({ success: false, error: 'Server error updating profile' });
    }
});

// Get specific user by ID (admin only)
router.get('/:id', authenticateJWT, isAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password -googleId -__v');
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        res.json({
            success: true,
            data: user,
            message: 'User retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching user by id:', error);
        res.status(500).json({ success: false, error: 'Server error fetching user' });
    }
});

// Update user role (admin only)
router.put('/:id/role', authenticateJWT, isAdmin, async (req, res) => {
    try {
        const { role } = req.body;

        if (!role || !['admin', 'staff', 'user'].includes(role)) {
            return res.status(400).json({ success: false, error: 'Invalid role specified' });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        user.role = role;
        await user.save();

        res.json({
            success: true,
            data: user,
            message: 'User role updated successfully'
        });
    } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({ success: false, error: 'Server error updating user role' });
    }
});

// TODO: Add routes for admin to manage users (get all, get one, update role, delete)

module.exports = router; 