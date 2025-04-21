const express = require('express');
const ContactMessage = require('../models/ContactMessage');
const { authenticateJWT, isAdmin } = require('../middleware/auth');

const router = express.Router();

// Submit a new contact form (public)
router.post('/', async (req, res) => {
    try {
        const { name, email, phone, subject, message } = req.body;

        if (!name || !email || !subject || !message) {
            return res.status(400).json({
                success: false,
                error: 'Please provide all required fields'
            });
        }

        // Create new contact message
        const contactMessage = new ContactMessage({
            name,
            email,
            phone: phone || '',
            subject,
            message,
            // If user is authenticated, associate this message with their account
            ...(req.user && { user: req.user.id })
        });

        await contactMessage.save();

        res.status(201).json({
            success: true,
            message: 'Your message has been sent successfully. We will get back to you soon.',
        });
    } catch (error) {
        console.error('Error submitting contact form:', error);
        res.status(500).json({
            success: false,
            error: 'There was a problem submitting your message. Please try again later.'
        });
    }
});

// Get all contact messages (admin only)
router.get('/', authenticateJWT, isAdmin, async (req, res) => {
    try {
        const messages = await ContactMessage.find({})
            .populate('user', 'name email role')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            data: messages
        });
    } catch (error) {
        console.error('Error fetching contact messages:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch contact messages'
        });
    }
});

// Get a specific contact message (admin only)
router.get('/:id', authenticateJWT, isAdmin, async (req, res) => {
    try {
        const message = await ContactMessage.findById(req.params.id)
            .populate('user', 'name email role');

        if (!message) {
            return res.status(404).json({
                success: false,
                error: 'Message not found'
            });
        }

        res.json({
            success: true,
            data: message
        });
    } catch (error) {
        console.error('Error fetching contact message:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch contact message'
        });
    }
});

// Update message status (admin only)
router.put('/:id/status', authenticateJWT, isAdmin, async (req, res) => {
    try {
        const { status } = req.body;

        if (!status || !['new', 'read', 'replied', 'archived'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid status'
            });
        }

        const message = await ContactMessage.findById(req.params.id);

        if (!message) {
            return res.status(404).json({
                success: false,
                error: 'Message not found'
            });
        }

        message.status = status;
        await message.save();

        res.json({
            success: true,
            data: message,
            message: 'Message status updated successfully'
        });
    } catch (error) {
        console.error('Error updating message status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update message status'
        });
    }
});

// Delete a message (admin only)
router.delete('/:id', authenticateJWT, isAdmin, async (req, res) => {
    try {
        const message = await ContactMessage.findByIdAndDelete(req.params.id);

        if (!message) {
            return res.status(404).json({
                success: false,
                error: 'Message not found'
            });
        }

        res.json({
            success: true,
            message: 'Contact message deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting contact message:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete contact message'
        });
    }
});

module.exports = router; 