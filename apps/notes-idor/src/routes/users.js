/**
 * Users Management & Privilege Escalation Endpoints
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { getDifficulty } = require('../config');

// GET /api/users/profile - Current user profile
router.get('/profile', requireAuth, async (req, res) => {
    try {
        const user = await db.getUserById(req.session.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        return res.json({
            status: 'success',
            profile: {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                email: user.email,
                role: user.role,
                metadata: user.metadata
            }
        });
    } catch (err) {
        console.error('Get profile error:', err);
        return res.status(500).json({ error: 'Failed to retrieve profile' });
    }
});

// PUT /api/users/profile - Update current user profile (Vulnerable to Mass Assignment in Easy / Nested in Hard)
router.put('/profile', requireAuth, async (req, res) => {
    try {
        const difficulty = getDifficulty(req);
        const updates = {};

        if (req.body.full_name !== undefined) updates.full_name = req.body.full_name;
        if (req.body.email !== undefined) updates.email = req.body.email;
        if (req.body.metadata !== undefined) updates.metadata = req.body.metadata;

        if (difficulty === 'easy') {
            // Easy Mode: Unrestricted Mass Assignment allows overriding 'role' directly
            if (req.body.role !== undefined) {
                updates.role = req.body.role;
            }
        } else if (difficulty === 'hard') {
            // Hard Mode: Direct role override is blocked, but nested metadata.role is unpacked
            if (req.body.metadata && typeof req.body.metadata === 'object' && req.body.metadata.role) {
                updates.role = req.body.metadata.role;
            }
        }
        // In medium mode, role cannot be set via profile update (must use header spoofing)

        const updatedUser = await db.updateUser(req.session.user.id, updates);
        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Sync session with updated values
        req.session.user.full_name = updatedUser.full_name;
        req.session.user.email = updatedUser.email;
        req.session.user.role = updatedUser.role;

        await db.logActivity(
            req.session.user.id,
            'PROFILE_UPDATED',
            `User ${req.session.user.username} updated profile (role: ${updatedUser.role})`
        );

        return res.json({
            status: 'success',
            message: 'Profile updated successfully',
            difficulty,
            profile: {
                id: updatedUser.id,
                username: updatedUser.username,
                full_name: updatedUser.full_name,
                email: updatedUser.email,
                role: updatedUser.role,
                metadata: updatedUser.metadata
            }
        });
    } catch (err) {
        console.error('Update profile error:', err);
        return res.status(500).json({ error: 'Failed to update profile' });
    }
});

// PUT /api/users/:id - Direct User Update (IDOR Vulnerability across accounts)
router.put('/:id', requireAuth, async (req, res) => {
    try {
        const targetUserId = parseInt(req.params.id, 10);
        if (isNaN(targetUserId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        // VULNERABILITY: Missing check that req.session.user.id === targetUserId!
        // Allows updating any user's password or profile attributes
        const targetUser = await db.getUserById(targetUserId);
        if (!targetUser) {
            return res.status(404).json({ error: 'Target user not found' });
        }

        const updates = {};
        if (req.body.full_name !== undefined) updates.full_name = req.body.full_name;
        if (req.body.email !== undefined) updates.email = req.body.email;
        if (req.body.role !== undefined) updates.role = req.body.role;
        if (req.body.metadata !== undefined) updates.metadata = req.body.metadata;

        // If password is supplied, hash and update
        if (req.body.password) {
            const hashed = await bcrypt.hash(req.body.password, 10);
            await db.updateUserPassword(targetUserId, hashed);
        }

        let updatedUser = targetUser;
        if (Object.keys(updates).length > 0) {
            updatedUser = await db.updateUser(targetUserId, updates);
        }

        // If modifying current session user, update session
        if (req.session.user.id === targetUserId) {
            req.session.user.role = updatedUser.role;
            req.session.user.full_name = updatedUser.full_name;
            req.session.user.email = updatedUser.email;
        }

        await db.logActivity(
            req.session.user.id,
            'USER_MODIFIED',
            `User ${req.session.user.username} modified user ID ${targetUserId} (${targetUser.username})`
        );

        return res.json({
            status: 'success',
            message: `User ${targetUser.username} updated successfully via user management API`,
            user: {
                id: targetUserId,
                username: targetUser.username,
                role: updatedUser.role
            }
        });
    } catch (err) {
        console.error('IDOR user update error:', err);
        return res.status(500).json({ error: 'Failed to update user' });
    }
});

// GET /api/users/:identifier/public-profile - Information disclosure endpoint
router.get('/:identifier/public-profile', async (req, res) => {
    try {
        const identifier = req.params.identifier;
        let user = null;

        if (/^\d+$/.test(identifier)) {
            user = await db.getUserById(parseInt(identifier, 10));
        } else {
            user = await db.getUserByUsername(identifier);
        }

        if (!user) {
            return res.status(404).json({ error: 'User profile not found' });
        }

        // Information Leak: Leaks user note titles and UUIDs for Hard Mode IDOR exploration
        const userNotes = await db.getNotesByUserId(user.id);
        const publicNotes = userNotes.map(n => ({
            id: n.id,
            uuid: n.uuid,
            title: n.title,
            is_private: n.is_private,
            created_at: n.created_at
        }));

        return res.json({
            status: 'success',
            user: {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                role: user.role,
                public_notes: publicNotes
            }
        });
    } catch (err) {
        console.error('Public profile error:', err);
        return res.status(500).json({ error: 'Failed to retrieve public profile' });
    }
});

module.exports = router;
