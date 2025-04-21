const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Required if you need to check against DB

const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret';

const authenticateJWT = (req, res, next) => {
    // Look for token in Authorization header first
    const authHeader = req.headers.authorization;
    let token;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    }
    // Optional: Fallback to checking cookies if needed (depends on your auth strategy)
    // else if (req.cookies && req.cookies.token) { 
    //   token = req.cookies.token;
    // }

    if (token) {
        jwt.verify(token, JWT_SECRET, (err, decoded) => { // Renamed 'user' to 'decoded' to avoid confusion
            if (err) {
                console.error("JWT Verification Error:", err.message);
                // Handle specific errors like token expiration
                if (err.name === 'TokenExpiredError') {
                    return res.status(401).json({ success: false, error: 'Token expired. Please log in again.' });
                }
                return res.status(403).json({ success: false, error: 'Invalid token.' });
            }

            // Attach the decoded payload (which contains user id, email, role) to the request
            req.user = decoded;
            next();
        });
    } else {
        res.status(401).json({ success: false, error: 'Authentication required. No token provided.' });
    }
};

const isAdmin = (req, res, next) => {
    // Assumes authenticateJWT has run first and populated req.user
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ success: false, error: 'Admin access required.' });
    }
};

module.exports = {
    authenticateJWT,
    isAdmin
}; 