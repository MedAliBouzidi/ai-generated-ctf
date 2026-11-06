/**
 * Authentication and Authorization Middleware
 */

const { getDifficulty } = require('../config');

/**
 * Ensures user is authenticated via session
 */
function requireAuth(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    }

    if (req.accepts('html') && !req.accepts('json')) {
        return res.redirect('/login');
    }

    return res.status(401).json({
        error: 'Authentication required. Please log in first.'
    });
}

/**
 * Checks Administrator Privileges based on active difficulty mode
 */
function requireAdmin(req, res, next) {
    const difficulty = getDifficulty(req);

    // Hard Mode: Strictly verified database role from authenticated session
    if (difficulty === 'hard') {
        if (req.session && req.session.user && req.session.user.role === 'admin') {
            return next();
        }
        return res.status(403).json({
            error: 'Forbidden: Administrator privilege required',
            difficulty
        });
    }

    // Medium Mode: Vulnerable to Header Spoofing or Method Override
    if (difficulty === 'medium') {
        const headerRole = req.headers['x-role'] || req.headers['x-user-role'];
        const methodOverride = req.headers['x-http-method-override'];

        if (headerRole === 'admin' || methodOverride === 'ADMIN') {
            req.adminSpoofed = true;
            return next();
        }

        if (req.session && req.session.user && req.session.user.role === 'admin') {
            return next();
        }

        return res.status(403).json({
            error: 'Forbidden: Administrator privilege required',
            difficulty,
            hint: 'Access control evaluates role headers in this tier.'
        });
    }

    // Easy Mode: Checks session role (vulnerable to mass assignment on profile update)
    if (req.session && req.session.user && req.session.user.role === 'admin') {
        return next();
    }

    return res.status(403).json({
        error: 'Forbidden: Administrator privilege required',
        difficulty,
        hint: 'User role can be escalated via user profile parameters.'
    });
}

module.exports = {
    requireAuth,
    requireAdmin
};
