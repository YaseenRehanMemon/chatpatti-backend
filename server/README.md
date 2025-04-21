
# Restaurant Website Server

This is the backend server for the restaurant website. It provides API endpoints for user authentication, menu items, orders, and payments.

## Prerequisites

- Node.js (v14+ recommended)
- MongoDB database
- Stripe account for payment processing
- Google OAuth credentials for authentication

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```
MONGODB_URI=mongodb+srv://your-mongodb-uri
JWT_SECRET=your-jwt-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret
PORT=3001
```

## Installation

```bash
npm install
```

## Running the Server

### Development

```bash
npm run dev
```

### Production

```bash
npm start
```

## API Endpoints

### Authentication

- `GET /api/auth/google` - Initiate Google OAuth
- `GET /api/auth/google/callback` - Google OAuth callback
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Menu Items

- `GET /api/menu-items` - Get all menu items
- `GET /api/menu-items/:id` - Get a specific menu item
- `POST /api/menu-items` - Create a new menu item (admin only)
- `PUT /api/menu-items/:id` - Update a menu item (admin only)
- `DELETE /api/menu-items/:id` - Delete a menu item (admin only)

### Orders

- `GET /api/orders` - Get user orders (or all orders for admin)
- `GET /api/orders/:id` - Get a specific order
- `POST /api/orders` - Create a new order
- `PUT /api/orders/:id` - Update an order status (admin only)
- `POST /api/orders/:id/cancel` - Cancel an order

### User Profile

- `PUT /api/users/profile` - Update user profile

### Payments

- `POST /api/payments/create-checkout-session` - Create a Stripe checkout session
- `POST /api/payments/webhook` - Handle Stripe webhooks
