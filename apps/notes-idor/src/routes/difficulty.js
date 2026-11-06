/**
 * Difficulty Configuration & Mode Switching Endpoints
 */

const express = require('express');
const router = express.Router();
const { getDifficulty, setRuntimeDifficulty } = require('../config');

// GET /api/difficulty - Retrieve active difficulty mode
router.get('/', (req, res) => {
    const active = getDifficulty(req);
    const envDefault = (process.env.NOTES_IDOR_DIFFICULTY || process.env.DIFFICULTY || 'easy').toLowerCase();

    return res.json({
        status: 'success',
        difficulty: active,
        env_default: envDefault,
        supported: ['easy', 'medium', 'hard']
    });
});

// POST /api/difficulty - Switch difficulty mode for current session and runtime
router.post('/', (req, res) => {
    const { difficulty } = req.body;

    if (!difficulty || !['easy', 'medium', 'hard'].includes(difficulty.toLowerCase())) {
        return res.status(400).json({
            error: 'Invalid difficulty level. Must be one of: easy, medium, hard'
        });
    }

    const selected = difficulty.toLowerCase();
    req.session.difficulty = selected;
    setRuntimeDifficulty(selected);

    return res.json({
        status: 'success',
        message: `Difficulty successfully changed to ${selected}`,
        difficulty: selected
    });
});

module.exports = router;
