const express = require('express');
const { authenticateJWT, isAdmin } = require('../middleware/auth');
const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const User = require('../models/User');

const router = express.Router();

// Secure all admin routes with authentication and admin role check
router.use(authenticateJWT, isAdmin);

// Get dashboard stats
router.get('/dashboard/stats', async (req, res) => {
    try {
        // Get total orders count
        const totalOrders = await Order.countDocuments();

        // Get total revenue
        const orders = await Order.find({});
        const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);

        // Get total users count
        const totalUsers = await User.countDocuments();

        // Get pending orders count
        const pendingOrders = await Order.countDocuments({ status: 'pending' });

        res.json({
            success: true,
            data: {
                totalOrders,
                totalRevenue,
                totalUsers,
                pendingOrders
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch dashboard stats' });
    }
});

// Get orders by day of week
router.get('/dashboard/orders-by-day', async (req, res) => {
    try {
        // Aggregate orders by day of week
        const result = await Order.aggregate([
            {
                $group: {
                    _id: { $dayOfWeek: { date: "$createdAt", timezone: "UTC" } },
                    orders: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Map day numbers to day names
        const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        // Convert to expected format
        const ordersByDay = result.map(item => ({
            date: daysOfWeek[item._id % 7],
            orders: item.orders
        }));

        // Ensure all days are present
        const allDays = daysOfWeek.map(day => {
            const foundDay = ordersByDay.find(item => item.date === day);
            return foundDay || { date: day, orders: 0 };
        });

        res.json({
            success: true,
            data: allDays
        });
    } catch (error) {
        console.error('Error fetching orders by day:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch orders by day' });
    }
});

// Get revenue by day of week
router.get('/dashboard/revenue-by-day', async (req, res) => {
    try {
        // Aggregate revenue by day of week
        const result = await Order.aggregate([
            {
                $group: {
                    _id: { $dayOfWeek: { date: "$createdAt", timezone: "UTC" } },
                    revenue: { $sum: "$totalAmount" }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Map day numbers to day names
        const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        // Convert to expected format
        const revenueByDay = result.map(item => ({
            date: daysOfWeek[item._id % 7],
            revenue: item.revenue
        }));

        // Ensure all days are present
        const allDays = daysOfWeek.map(day => {
            const foundDay = revenueByDay.find(item => item.date === day);
            return foundDay || { date: day, revenue: 0 };
        });

        res.json({
            success: true,
            data: allDays
        });
    } catch (error) {
        console.error('Error fetching revenue by day:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch revenue by day' });
    }
});

// Get top selling items
router.get('/dashboard/top-selling', async (req, res) => {
    try {
        // First, get all orders
        const orders = await Order.find({}).populate('items.menuItem');

        // Create a map to track sales and revenue for each menu item
        const itemSales = new Map();

        // Process orders to calculate sales and revenue
        orders.forEach(order => {
            order.items.forEach(item => {
                if (typeof item.menuItem === 'object' && item.menuItem !== null) {
                    const itemId = item.menuItem._id.toString();
                    if (!itemSales.has(itemId)) {
                        itemSales.set(itemId, {
                            _id: itemId,
                            name: item.menuItem.name,
                            image: item.menuItem.image,
                            sales: 0,
                            revenue: 0
                        });
                    }

                    const currentItem = itemSales.get(itemId);
                    currentItem.sales += item.quantity;
                    currentItem.revenue += item.price * item.quantity;
                }
            });
        });

        // Convert map to array and sort by sales
        const topItems = Array.from(itemSales.values())
            .sort((a, b) => b.sales - a.sales)
            .slice(0, 5); // Get top 5

        res.json({
            success: true,
            data: topItems
        });
    } catch (error) {
        console.error('Error fetching top selling items:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch top selling items' });
    }
});

// Get all users with additional info for admin
router.get('/users', async (req, res) => {
    try {
        // Get all users
        const users = await User.find({})
            .select('-password -googleId -__v')
            .sort({ createdAt: -1 });

        // Get orders to calculate order count for each user
        const orders = await Order.find({});

        // Calculate order count and last activity for each user
        const enrichedUsers = await Promise.all(users.map(async (user) => {
            // Count orders for this user
            const userOrders = orders.filter(order =>
                order.user && order.user.toString() === user._id.toString()
            );

            // Find most recent login or order
            const lastOrderDate = userOrders.length > 0
                ? new Date(Math.max(...userOrders.map(o => new Date(o.createdAt).getTime())))
                : null;

            // Determine user status based on activity
            // This is just an example logic - customize as needed
            let status = 'active';
            if (userOrders.length === 0) {
                const userCreationDate = new Date(user.createdAt);
                const sixMonthsAgo = new Date();
                sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

                if (userCreationDate < sixMonthsAgo) {
                    status = 'inactive';
                }
            }

            return {
                ...user._doc,
                orders: userOrders.length,
                lastActivity: lastOrderDate || user.updatedAt,
                status
            };
        }));

        res.json({
            success: true,
            data: enrichedUsers,
            message: 'Users retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching users for admin:', error);
        res.status(500).json({ success: false, error: 'Server error fetching users' });
    }
});

module.exports = router; 