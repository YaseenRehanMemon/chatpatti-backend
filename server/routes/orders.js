const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const { authenticateJWT, isAdmin } = require('../middleware/auth');
const mongoose = require('mongoose');

// Get all orders (admin) or user's orders
router.get('/', authenticateJWT, async (req, res) => {
    try {
        let orders;
        if (req.user.role === 'admin') {
            // Admins can see all orders
            orders = await Order.find()
                .populate('user', 'name email') // Populate user data
                .populate('items.menuItem', 'name price image category') // Populate menu item data
                .sort({ createdAt: -1 });
        } else {
            // Regular users can only see their own orders
            orders = await Order.find({ user: req.user.id })
                .populate('items.menuItem', 'name price image category')
                .sort({ createdAt: -1 });
        }
        res.json({ success: true, data: orders });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching orders',
            error: error.message
        });
    }
});

// Get a single order by ID
router.get('/:id', authenticateJWT, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('user', 'name email')
            .populate('items.menuItem', 'name price image category');

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Check if the user is authorized to view this order
        if (req.user.role !== 'admin' && order.user.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized to view this order'
            });
        }

        res.json({ success: true, data: order });
    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching order',
            error: error.message
        });
    }
});

// Create a new order
router.post('/', authenticateJWT, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { 
            items,
            contactPhone,
            orderType,
            deliveryAddress,
            paymentMethod,
            paymentStatus,
            specialInstructions,
            paymentIntentId 
        } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No items in order'
            });
        }

        // Extract menu item IDs from items array
        const menuItemIds = items.map(item =>
            item.menuItemId || (item.menuItem && typeof item.menuItem === 'string' ? item.menuItem : item.menuItem._id)
        );

        // Fetch menu items from database
        const menuItems = await MenuItem.find({ _id: { $in: menuItemIds } }).session(session);

        // Create map for faster lookups
        const menuItemMap = {};
        menuItems.forEach(item => {
            menuItemMap[item._id.toString()] = item;
        });

        // Validate items and calculate total
        let calculatedSubtotal = 0;
        const orderItems = [];

        for (const item of items) {
            const menuItemId = item.menuItemId ||
                (item.menuItem && typeof item.menuItem === 'string' ? item.menuItem : item.menuItem._id);

            const menuItem = menuItemMap[menuItemId.toString()];

            if (!menuItem) {
                await session.abortTransaction();
                session.endSession();
                return res.status(404).json({
                    success: false,
                    message: `Menu item with id ${menuItemId} not found`
                });
            }

            // Calculate item price * quantity
            const itemSubtotal = menuItem.price * item.quantity;
            calculatedSubtotal += itemSubtotal;

            // Add to order items with price from database
            orderItems.push({
                menuItem: menuItemId,
                quantity: item.quantity,
                specialInstructions: item.specialInstructions,
                price: menuItem.price // Use price from database
            });
        }

        // Calculate tax (8.25%)
        const tax = calculatedSubtotal * 0.0825;

        // Calculate delivery fee if applicable
        const deliveryFee = orderType === 'delivery' ? 3.99 : 0;

        // Calculate total
        const totalAmount = calculatedSubtotal + tax + deliveryFee;

        // Create new order
        const newOrder = new Order({
            user: req.user.id,
            items: orderItems,
            status: 'pending',
            totalAmount: totalAmount,
            paymentStatus: paymentStatus || 'pending',
            paymentMethod: paymentMethod,
            deliveryAddress: orderType === 'delivery' ? deliveryAddress : undefined,
            contactPhone: contactPhone,
            orderType: orderType,
            specialInstructions: specialInstructions,
            tax: tax,
            deliveryFee: deliveryFee,
            stripePaymentIntentId: paymentIntentId
        });

        await newOrder.save({ session });

        // Populate the order for response
        await newOrder.populate('user', 'name email');
        await newOrder.populate('items.menuItem', 'name price image category');

        await session.commitTransaction();
        session.endSession();

        res.status(201).json({
            success: true, 
            data: newOrder,
            message: 'Order created successfully'
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();

        console.error('Error creating order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create order',
            error: error.message
        });
    }
});

// Update order status (admin only)
router.put('/:id/status', authenticateJWT, isAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['pending', 'preparing', 'ready', 'delivered', 'completed', 'cancelled'];

        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status value'
            });
        }

        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        order.status = status;
        order.updatedAt = Date.now();

        await order.save();

        // Populate the updated order for the response
        await order.populate('user', 'name email');
        await order.populate('items.menuItem', 'name price image category');

        res.json({
            success: true,
            data: order,
            message: 'Order status updated successfully'
        });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating order status',
            error: error.message
        });
    }
});

// Cancel an order (user can cancel their own orders, admin can cancel any)
router.post('/:id/cancel', authenticateJWT, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Allow cancellation only if user is admin or order belongs to user
        if (req.user.role !== 'admin' && order.user.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized to cancel this order'
            });
        }

        // Allow cancellation only if order is in a cancellable state
        const cancellableStatuses = ['pending', 'confirmed', 'preparing'];
        if (!cancellableStatuses.includes(order.status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot cancel an order with status "${order.status}"`
            });
        }

        order.status = 'cancelled';
        order.updatedAt = Date.now();

        await order.save();

        // Populate the updated order for the response
        await order.populate('user', 'name email');
        await order.populate('items.menuItem', 'name price image category');

        res.json({
            success: true, 
            data: order,
            message: 'Order cancelled successfully'
        });
    } catch (error) {
        console.error('Error cancelling order:', error);
        res.status(500).json({
            success: false,
            message: 'Error cancelling order',
            error: error.message
        });
    }
});

module.exports = router; 