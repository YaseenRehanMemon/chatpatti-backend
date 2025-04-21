const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/Order'); // Needed for webhook
const { authenticateJWT } = require('../middleware/auth');

const router = express.Router();
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:8080';

// Create Stripe Checkout Session (Example - may need adjustment based on actual flow)
router.post('/create-checkout-session', authenticateJWT, async (req, res) => {
    try {
        const { items, amount } = req.body; // Expecting simplified items/amount or an orderId

        if (!amount || amount < 1) {
            return res.status(400).json({ success: false, error: 'Invalid amount for checkout.' });
        }

        // TODO: Potentially fetch order details based on an orderId passed in req.body
        // to ensure amount and items match server-side data.

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd', // Consider making currency dynamic or use env var
                        product_data: {
                            name: 'Your Food Order', // Customize as needed
                            // description: `Order ID: ${orderId}`, // Example if using orderId
                        },
                        unit_amount: Math.round(amount * 100), // Amount in cents
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${CLIENT_URL}/checkout?success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${CLIENT_URL}/checkout?canceled=true`,
            metadata: {
                // Include metadata needed in webhook, e.g., userId or orderId
                userId: req.user.id,
                // orderId: orderId, 
            }
        });

        res.json({
            success: true,
            data: { url: session.url }
        });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({ success: false, error: 'Error creating payment session' });
    }
});

// Create Payment Intent (Used for Elements/direct card payments)
router.post("/create-payment-intent", authenticateJWT, async (req, res) => { // Added auth middleware
    const { amount } = req.body; // Amount is expected in main currency unit (e.g., dollars)

    if (!amount || amount < 0.50) { // Stripe minimum is often $0.50
        return res.status(400).json({ success: false, error: "Invalid amount for payment intent." });
    }

    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Convert to cents
            currency: "usd", // Change currency if needed
            automatic_payment_methods: {
                enabled: true,
            },
            metadata: {
                userId: req.user.id, // Add user ID for tracking
            }
        });

        res.send({
            success: true,
            clientSecret: paymentIntent.client_secret,
        });
    } catch (error) {
        console.error("Error creating payment intent:", error);
        res.status(500).json({ success: false, error: "Failed to create payment intent" });
    }
});


// Stripe Webhook Endpoint
// Needs to be configured in your Stripe dashboard to point to: your_domain/api/payments/webhook
// Use express.raw middleware for webhook signature verification
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const signature = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
        console.error("Stripe webhook secret not set.");
        return res.status(500).send('Webhook configuration error.');
    }

    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body, // Use the raw body buffer
            signature,
            webhookSecret
        );
    } catch (error) {
        console.error('Webhook signature verification failed:', error.message);
        return res.status(400).send(`Webhook Error: ${error.message}`);
    }

    // Handle the specific event types
    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object;
            console.log('Checkout session completed:', session.id);
            // Fulfill the purchase (e.g., update order status)
            // Metadata should contain necessary info like userId or orderId
            const userId = session.metadata?.userId;
            const paymentIntentId = session.payment_intent;
            if (userId && paymentIntentId) {
                try {
                    // Find the corresponding order and update payment status
                    const order = await Order.findOneAndUpdate(
                        { user: userId, paymentIntentId: paymentIntentId, paymentStatus: 'pending' },
                        { paymentStatus: 'paid' },
                        { new: true }
                    );
                    if (order) {
                        console.log(`Order ${order._id} marked as paid via checkout session.`);
                        // TODO: Emit event, send email, etc.
                    } else {
                        console.warn(`No matching pending order found for user ${userId} and PI ${paymentIntentId} from checkout session.`);
                    }
                } catch (dbError) {
                    console.error('DB Error updating order from checkout webhook:', dbError);
                }
            }
            break;
        }
        case 'payment_intent.succeeded': {
            const paymentIntent = event.data.object;
            console.log('PaymentIntent succeeded:', paymentIntent.id);
            // Fulfill the purchase (e.g., update order status based on PI)
            const userId = paymentIntent.metadata?.userId;
            if (userId) {
                try {
                    // Find the corresponding order and update payment status
                    const order = await Order.findOneAndUpdate(
                        { user: userId, paymentIntentId: paymentIntent.id, paymentStatus: 'pending' },
                        { paymentStatus: 'paid' },
                        { new: true }
                    );
                    if (order) {
                        console.log(`Order ${order._id} marked as paid via payment intent.`);
                        // TODO: Emit event, send email, etc.
                    } else {
                        console.warn(`No matching pending order found for user ${userId} and PI ${paymentIntent.id}.`);
                    }
                } catch (dbError) {
                    console.error('DB Error updating order from payment_intent webhook:', dbError);
                }
            }
            break;
        }
        case 'payment_intent.payment_failed': {
            const paymentIntent = event.data.object;
            console.log('PaymentIntent failed:', paymentIntent.id, paymentIntent.last_payment_error?.message);
            // Notify the user, log the failure, potentially update order status to 'failed'
            break;
        }
        // ... handle other event types as needed
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    res.json({ received: true });
});


module.exports = router; 