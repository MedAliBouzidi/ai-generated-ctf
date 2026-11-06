/**
 * Notes Management & IDOR Vulnerability Endpoints
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { getDifficulty, getFlag } = require('../config');

// GET /api/notes - List notes for current user
router.get('/', requireAuth, async (req, res) => {
    try {
        const difficulty = getDifficulty(req);
        const userNotes = await db.getNotesByUserId(req.session.user.id);

        // Format note IDs based on difficulty level
        const formattedNotes = userNotes.map(n => {
            let displayId = n.id;
            if (difficulty === 'medium') {
                // Obfuscated Base64 representation of integer ID
                displayId = Buffer.from(String(n.id)).toString('base64');
            } else if (difficulty === 'hard') {
                // UUID representation
                displayId = n.uuid;
            }

            return {
                id: displayId,
                raw_id: n.id,
                uuid: n.uuid,
                title: n.title,
                content: n.content,
                is_private: n.is_private,
                created_at: n.created_at
            };
        });

        return res.json({
            status: 'success',
            difficulty,
            notes: formattedNotes
        });
    } catch (err) {
        console.error('List notes error:', err);
        return res.status(500).json({ error: 'Failed to retrieve notes' });
    }
});

// GET /api/notes/:id - View specific note (IDOR Vulnerability)
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const difficulty = getDifficulty(req);
        const paramId = req.params.id;
        let note = null;

        if (difficulty === 'easy') {
            // Easy Mode: Direct sequential numeric ID parameter without ownership verification
            const noteId = parseInt(paramId, 10);
            if (isNaN(noteId)) {
                return res.status(400).json({ error: 'Invalid numeric note ID' });
            }
            note = await db.getNoteById(noteId);
        } else if (difficulty === 'medium') {
            // Medium Mode: Obfuscated Base64 ID or Query Parameter Override
            let lookupId = null;

            // Parameter override (?note_id=1) takes precedence
            if (req.query.note_id) {
                lookupId = parseInt(req.query.note_id, 10);
            } else {
                // Try decoding Base64 parameter (e.g. 'MQ==' -> '1')
                try {
                    const decoded = Buffer.from(paramId, 'base64').toString('utf8');
                    if (/^\d+$/.test(decoded)) {
                        lookupId = parseInt(decoded, 10);
                    }
                } catch (e) {
                    // Not valid base64
                }

                // Fallback to direct numeric if provided
                if (!lookupId && /^\d+$/.test(paramId)) {
                    lookupId = parseInt(paramId, 10);
                }
            }

            if (!lookupId) {
                return res.status(400).json({
                    error: 'Invalid note identifier format',
                    hint: 'Identifiers in this mode are base64 encoded, or accept parameter override via ?note_id='
                });
            }

            note = await db.getNoteById(lookupId);
        } else {
            // Hard Mode: UUID identifier lookup (unprotected endpoint leaking data once UUID is discovered)
            if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paramId)) {
                note = await db.getNoteByUuid(paramId);
            } else if (/^\d+$/.test(paramId)) {
                // If numeric passed in hard mode, still query
                note = await db.getNoteById(parseInt(paramId, 10));
            } else {
                // Check if UUID was provided in query param
                if (req.query.uuid) {
                    note = await db.getNoteByUuid(req.query.uuid);
                }
            }
        }

        if (!note) {
            return res.status(404).json({ error: 'Note not found' });
        }

        // VULNERABILITY: No authorization check!
        // Missing: if (note.user_id !== req.session.user.id && note.is_private) { return 403; }

        // Dynamic flag injection for Administrator's confidential note (ID 1 or Admin UUID)
        const isAdminNote = note.id === 1 || note.uuid === 'a1b2c3d4-e5f6-4789-9abc-def012345678';
        let content = note.content;

        if (isAdminNote) {
            const flag = getFlag('view', difficulty);
            content = `CONFIDENTIAL EXECUTIVE MEMO:\n\nCTF Flag: ${flag}\n\nInternal Network Credentials:\nDatabase: notes_db\nCluster: internal-alpha\nAuthorized access only.`;
        }

        return res.json({
            status: 'success',
            difficulty,
            note: {
                id: note.id,
                uuid: note.uuid,
                title: note.title,
                content: content,
                is_private: note.is_private,
                owner: note.owner_username || 'admin',
                created_at: note.created_at
            }
        });
    } catch (err) {
        console.error('View note error:', err);
        return res.status(500).json({ error: 'Failed to retrieve note' });
    }
});

// POST /api/notes - Create note
router.post('/', requireAuth, async (req, res) => {
    try {
        const { title, content, is_private } = req.body;

        if (!title || !content) {
            return res.status(400).json({ error: 'Title and content are required' });
        }

        const noteUuid = uuidv4();
        const newNote = await db.createNote({
            uuid: noteUuid,
            user_id: req.session.user.id,
            title,
            content,
            is_private: is_private !== undefined ? Boolean(is_private) : true
        });

        await db.logActivity(
            req.session.user.id,
            'NOTE_CREATED',
            `User ${req.session.user.username} created note: ${title}`,
            noteUuid
        );

        return res.status(201).json({
            status: 'success',
            message: 'Note created successfully',
            note: newNote
        });
    } catch (err) {
        console.error('Create note error:', err);
        return res.status(500).json({ error: 'Failed to create note' });
    }
});

// DELETE /api/notes/:id - Delete note
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const noteId = parseInt(req.params.id, 10);
        if (isNaN(noteId)) {
            return res.status(400).json({ error: 'Invalid note ID' });
        }

        const note = await db.getNoteById(noteId);
        if (!note) {
            return res.status(404).json({ error: 'Note not found' });
        }

        // Standard deletion check
        if (note.user_id !== req.session.user.id && req.session.user.role !== 'admin') {
            return res.status(403).json({ error: 'You are not permitted to delete this note' });
        }

        await db.deleteNote(noteId);
        await db.logActivity(req.session.user.id, 'NOTE_DELETED', `Deleted note ID ${noteId}`);

        return res.json({ status: 'success', message: 'Note deleted successfully' });
    } catch (err) {
        console.error('Delete note error:', err);
        return res.status(500).json({ error: 'Failed to delete note' });
    }
});

module.exports = router;
