const express = require('express');
const MenuItem = require('../models/MenuItem');
const { authenticateJWT, isAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all available menu items (Public)
router.get('/', async (req, res) => {
    try {
        const menuItems = await MenuItem.find({ available: true });
        res.json({ success: true, data: menuItems });
    } catch (error) {
        console.error('Error fetching menu items:', error);
        res.status(500).json({ success: false, error: 'Server error fetching menu items' });
    }
});

// Get a specific menu item by ID (Public)
router.get('/:id', async (req, res) => {
    try {
        const menuItem = await MenuItem.findById(req.params.id);
        if (!menuItem) {
            return res.status(404).json({ success: false, error: 'Menu item not found' });
        }
        res.json({ success: true, data: menuItem });
    } catch (error) {
        console.error('Error fetching menu item:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// --- Admin Routes ---

// Create a new menu item (Admin only)
router.post('/', authenticateJWT, isAdmin, async (req, res) => {
    try {
        const menuItem = new MenuItem(req.body);
        await menuItem.save();

        res.status(201).json({ success: true, data: menuItem });
    } catch (error) {
        console.error('Error creating menu item:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ success: false, error: error.message });
        }
        res.status(500).json({ success: false, error: 'Server error creating menu item' });
    }
});

// Update a menu item (Admin only)
router.put('/:id', authenticateJWT, isAdmin, async (req, res) => {
    try {
        const menuItem = await MenuItem.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!menuItem) {
            return res.status(404).json({ success: false, error: 'Menu item not found' });
        }

        res.json({ success: true, data: menuItem });
    } catch (error) {
        console.error('Error updating menu item:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ success: false, error: error.message });
        }
        res.status(500).json({ success: false, error: 'Server error updating menu item' });
    }
});

// Delete a menu item (Admin only)
router.delete('/:id', authenticateJWT, isAdmin, async (req, res) => {
    try {
        const menuItem = await MenuItem.findByIdAndDelete(req.params.id);
        if (!menuItem) {
            return res.status(404).json({ success: false, error: 'Menu item not found' });
        }

        res.json({ success: true, message: 'Menu item deleted successfully' });
    } catch (error) {
        console.error('Error deleting menu item:', error);
        res.status(500).json({ success: false, error: 'Server error deleting menu item' });
    }
});

module.exports = router; 