/**
 * Administrator Dashboard & Flag Endpoints
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { getDifficulty, getFlag } = require('../config');

// GET /api/admin/flag - Retrieve privileged Administrator Flag
router.get('/flag', requireAdmin, (req, res) => {
    const difficulty = getDifficulty(req);
    const flag = getFlag('admin', difficulty);

    return res.json({
        status: 'success',
        difficulty,
        flag,
        message: 'Administrator authorization confirmed. CTF flag released.',
        auth_method: req.adminSpoofed ? 'Header Spoofing / Method Override' : 'Session Role Verification'
    });
});

// GET /api/admin/users - List all users (admin only)
router.get('/users', requireAdmin, async (req, res) => {
    try {
        const users = await db.getAllUsers();
        return res.json({
            status: 'success',
            users
        });
    } catch (err) {
        console.error('Admin users error:', err);
        return res.status(500).json({ error: 'Failed to retrieve user list' });
    }
});

// GET /api/admin/stats - Server statistics (admin only)
router.get('/stats', requireAdmin, async (req, res) => {
    try {
        const users = await db.getAllUsers();
        const activity = await db.getActivity(10);
        const difficulty = getDifficulty(req);

        return res.json({
            status: 'success',
            difficulty,
            stats: {
                total_users: users.length,
                db_engine: db.isPostgres() ? 'PostgreSQL 16' : 'Embedded Memory Store',
                uptime: process.uptime(),
                active_difficulty: difficulty,
                recent_events: activity.length
            }
        });
    } catch (err) {
        console.error('Admin stats error:', err);
        return res.status(500).json({ error: 'Failed to retrieve stats' });
    }
});

module.exports = router;
