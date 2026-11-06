/**
 * Authentication Routes
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { getDifficulty } = require('../config');

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const user = await db.getUserByUsername(username);
        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Establish session
        req.session.user = {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            email: user.email,
            role: user.role
        };

        await db.logActivity(user.id, 'USER_LOGIN', `User ${user.username} logged in successfully`);

        return res.json({
            status: 'success',
            message: 'Logged in successfully',
            user: req.session.user
        });
    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ error: 'Internal server error during login' });
    }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { username, password, full_name, email } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        if (username.length < 3 || username.length > 30) {
            return res.status(400).json({ error: 'Username must be between 3 and 30 characters' });
        }

        const existing = await db.getUserByUsername(username);
        if (existing) {
            return res.status(400).json({ error: 'Username already taken' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await db.createUser({
            username,
            password: hashedPassword,
            full_name: full_name || username,
            email: email || `${username}@vulnlab.local`,
            role: 'user'
        });

        req.session.user = {
            id: newUser.id,
            username: newUser.username,
            full_name: newUser.full_name,
            email: newUser.email,
            role: newUser.role
        };

        await db.logActivity(newUser.id, 'USER_REGISTER', `New user registered: ${newUser.username}`);

        return res.status(201).json({
            status: 'success',
            message: 'User registered successfully',
            user: req.session.user
        });
    } catch (err) {
        console.error('Registration error:', err);
        return res.status(500).json({ error: 'Internal server error during registration' });
    }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: 'Could not log out' });
        }
        res.clearCookie('connect.sid');
        return res.json({ status: 'success', message: 'Logged out successfully' });
    });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
    const difficulty = getDifficulty(req);
    if (req.session && req.session.user) {
        return res.json({
            authenticated: true,
            user: req.session.user,
            difficulty
        });
    }
    return res.json({
        authenticated: false,
        user: null,
        difficulty
    });
});

module.exports = router;
