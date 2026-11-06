/**
 * Recent Activity & Audit Log Endpoints
 * Serves as an information disclosure vector in Hard mode IDOR.
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { getDifficulty } = require('../config');

// GET /api/activity - Retrieve recent audit log entries
router.get('/', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit || '15', 10);
        const difficulty = getDifficulty(req);
        const logs = await db.getActivity(limit);

        return res.json({
            status: 'success',
            difficulty,
            count: logs.length,
            activity: logs.map(l => ({
                id: l.id,
                username: l.username || 'system',
                action: l.action,
                details: l.details,
                note_uuid: l.note_uuid,
                created_at: l.created_at
            }))
        });
    } catch (err) {
        console.error('Activity error:', err);
        return res.status(500).json({ error: 'Failed to retrieve activity log' });
    }
});

module.exports = router;
