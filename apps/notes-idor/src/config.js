/**
 * Application Configuration & Secret Management
 */

const PORT = parseInt(process.env.PORT || '8002', 10);
const DATABASE_URL = process.env.DATABASE_URL || '';
const SESSION_SECRET = process.env.SESSION_SECRET || 'vulnlab-notes-idor-secret-key-2026';

// Flags with strict 32-hex lowercase format fallback
const FLAGS = {
    view: {
        easy: process.env.FLAG_NOTES_IDOR_VIEW_EASY || 'VULNLAB{a101d02e3f4a5b6c7d8e9f0123456781}',
        medium: process.env.FLAG_NOTES_IDOR_VIEW_MEDIUM || 'VULNLAB{b202d03e4f5a6b7c8d9e0f1234567892}',
        hard: process.env.FLAG_NOTES_IDOR_VIEW_HARD || 'VULNLAB{c303d04e5f6a7b8c9d0e1f2345678903}'
    },
    admin: {
        easy: process.env.FLAG_NOTES_IDOR_ADMIN_EASY || 'VULNLAB{d404d05e6f7a8b9c0d1e2f3456789014}',
        medium: process.env.FLAG_NOTES_IDOR_ADMIN_MEDIUM || 'VULNLAB{e505d06e7f8a9b0c1d2e3f4567890125}',
        hard: process.env.FLAG_NOTES_IDOR_ADMIN_HARD || 'VULNLAB{f606d07e8f9a0b1c2d3e4f5678901236}'
    }
};

let runtimeDifficulty = (process.env.NOTES_IDOR_DIFFICULTY || process.env.DIFFICULTY || 'easy').toLowerCase();

/**
 * Resolves current difficulty mode.
 * Priority: Session override -> Request header -> Query parameter -> Runtime/Env var -> 'easy'
 */
function getDifficulty(req) {
    if (req) {
        if (req.session && req.session.difficulty) {
            const diff = req.session.difficulty.toLowerCase();
            if (['easy', 'medium', 'hard'].includes(diff)) return diff;
        }
        if (req.headers && req.headers['x-difficulty']) {
            const diff = req.headers['x-difficulty'].toLowerCase();
            if (['easy', 'medium', 'hard'].includes(diff)) return diff;
        }
        if (req.query && req.query.difficulty) {
            const diff = req.query.difficulty.toLowerCase();
            if (['easy', 'medium', 'hard'].includes(diff)) return diff;
        }
    }

    if (['easy', 'medium', 'hard'].includes(runtimeDifficulty)) return runtimeDifficulty;
    return 'easy';
}

function setRuntimeDifficulty(diff) {
    if (['easy', 'medium', 'hard'].includes(diff.toLowerCase())) {
        runtimeDifficulty = diff.toLowerCase();
    }
}

/**
 * Retrieve flag for given challenge category and difficulty.
 */
function getFlag(category, difficulty) {
    const diff = (difficulty || 'easy').toLowerCase();
    if (FLAGS[category] && FLAGS[category][diff]) {
        return FLAGS[category][diff];
    }
    return FLAGS[category]?.easy || 'VULNLAB{00000000000000000000000000000000}';
}

module.exports = {
    PORT,
    DATABASE_URL,
    SESSION_SECRET,
    FLAGS,
    getDifficulty,
    setRuntimeDifficulty,
    getFlag
};
