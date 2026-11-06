/**
 * Database Layer for VulnLab Notes CTF
 * Supports PostgreSQL 16 with automatic fallback to in-memory store for local testing.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { DATABASE_URL } = require('../config');

let pool = null;
let usePostgres = false;

// Embedded in-memory database store
const memoryStore = {
    users: [],
    notes: [],
    audit_logs: [],
    nextUserId: 4,
    nextNoteId: 6,
    nextLogId: 6
};

/**
 * Initialize default seed data in memory store
 */
function seedMemoryStore() {
    memoryStore.users = [
        {
            id: 1,
            username: 'admin',
            password: '$2b$10$L8zL3CgoOgCxQbtLc1GpK.FgnTejBwAIvcKqu68xyZro5K5L0pY1a', // AdminSecretPass2026!
            full_name: 'System Administrator',
            email: 'admin@vulnlab.local',
            role: 'admin',
            metadata: { department: 'Security Ops', clearance: 'Level 5' },
            created_at: new Date('2026-01-01T08:00:00Z')
        },
        {
            id: 2,
            username: 'alice',
            password: '$2b$10$BankjGnqH14.PRE5e2K53u/3JCTzoTEvnz2W574Tycu8G3fA3Krv.', // alice123
            full_name: 'Alice Smith',
            email: 'alice@vulnlab.local',
            role: 'user',
            metadata: { department: 'Engineering', team: 'Core' },
            created_at: new Date('2026-01-02T09:30:00Z')
        },
        {
            id: 3,
            username: 'bob',
            password: '$2b$10$ipAC8AazXida4iFpqOAfduIkelF2q0qA8ymXoPzbem5Mq7u9eYxSa', // bob123
            full_name: 'Bob Jones',
            email: 'bob@vulnlab.local',
            role: 'user',
            metadata: { department: 'QA', team: 'Automation' },
            created_at: new Date('2026-01-03T11:15:00Z')
        }
    ];

    memoryStore.notes = [
        {
            id: 1,
            uuid: 'a1b2c3d4-e5f6-4789-9abc-def012345678',
            user_id: 1,
            title: 'Executive Confidential - CTF System Secret',
            content: 'CONFIDENTIAL EXECUTIVE MEMO: System maintenance token and flag placeholder.',
            is_private: true,
            created_at: new Date('2026-01-01T08:05:00Z')
        },
        {
            id: 2,
            uuid: 'f5e4d3c2-b1a0-4987-8cba-fed987654321',
            user_id: 1,
            title: 'VulnLab Notes Platform Guidelines',
            content: 'Welcome to SecureNotes Internal Portal! All internal confidential notes are encrypted at rest and accessible only by authorized personnel.',
            is_private: false,
            created_at: new Date('2026-01-01T08:30:00Z')
        },
        {
            id: 3,
            uuid: 'b2c3d4e5-f6a7-4890-abcd-ef0123456789',
            user_id: 2,
            title: 'Alice Grocery List',
            content: '1. Organic Apples\n2. Almond Milk\n3. Whole Wheat Sourdough\n4. Dark Roast Coffee\n5. Greek Yogurt',
            is_private: true,
            created_at: new Date('2026-01-02T10:00:00Z')
        },
        {
            id: 4,
            uuid: 'c3d4e5f6-a7b8-4901-bcde-f0123456789a',
            user_id: 2,
            title: 'Alice Q4 Security Roadmap',
            content: 'Key Focus Areas:\n- Audit authorization middleware on all routes\n- Enforce strict parameter validation\n- Prevent mass assignment in user profiles\n- Remove internal audit leaks',
            is_private: false,
            created_at: new Date('2026-01-02T14:20:00Z')
        },
        {
            id: 5,
            uuid: 'd4e5f6a7-b8c9-4012-cdef-0123456789ab',
            user_id: 3,
            title: 'Bob Personal Sprint Tasks',
            content: 'Sprint 42 Checklist:\n1. Update automated API test suites\n2. Verify session cookie SameSite and HttpOnly flags\n3. Clean up legacy migration scripts',
            is_private: true,
            created_at: new Date('2026-01-03T11:45:00Z')
        }
    ];

    memoryStore.audit_logs = [
        {
            id: 1,
            user_id: 1,
            username: 'admin',
            action: 'NOTE_CREATED',
            details: 'Admin created note: Executive Confidential - CTF System Secret',
            note_uuid: 'a1b2c3d4-e5f6-4789-9abc-def012345678',
            created_at: new Date('2026-01-01T08:05:00Z')
        },
        {
            id: 2,
            user_id: 1,
            username: 'admin',
            action: 'SYSTEM_MAINTENANCE',
            details: 'Automated database vacuum and security audit completed',
            note_uuid: null,
            created_at: new Date('2026-01-01T12:00:00Z')
        },
        {
            id: 3,
            user_id: 2,
            username: 'alice',
            action: 'NOTE_CREATED',
            details: 'Alice created note: Alice Grocery List',
            note_uuid: 'b2c3d4e5-f6a7-4890-abcd-ef0123456789',
            created_at: new Date('2026-01-02T10:00:00Z')
        },
        {
            id: 4,
            user_id: 2,
            username: 'alice',
            action: 'NOTE_CREATED',
            details: 'Alice created note: Alice Q4 Security Roadmap',
            note_uuid: 'c3d4e5f6-a7b8-4901-bcde-f0123456789a',
            created_at: new Date('2026-01-02T14:20:00Z')
        },
        {
            id: 5,
            user_id: 3,
            username: 'bob',
            action: 'NOTE_CREATED',
            details: 'Bob created note: Bob Personal Sprint Tasks',
            note_uuid: 'd4e5f6a7-b8c9-4012-cdef-0123456789ab',
            created_at: new Date('2026-01-03T11:45:00Z')
        }
    ];
}

/**
 * Initialize Database Connection
 */
async function initDb() {
    seedMemoryStore();

    if (DATABASE_URL) {
        try {
            console.log(`[DB] Attempting PostgreSQL connection to: ${DATABASE_URL.replace(/:[^:]*@/, ':****@')}`);
            pool = new Pool({
                connectionString: DATABASE_URL,
                connectionTimeoutMillis: 4000
            });

            // Test query
            const client = await pool.connect();
            console.log('[DB] PostgreSQL connected successfully.');

            // Read init.sql
            const initSqlPath = path.join(__dirname, 'init.sql');
            if (fs.existsSync(initSqlPath)) {
                const sql = fs.readFileSync(initSqlPath, 'utf8');
                await client.query(sql);
                console.log('[DB] Schema and seed data applied to PostgreSQL.');
            }

            client.release();
            usePostgres = true;
            return;
        } catch (err) {
            console.warn(`[DB] PostgreSQL connection failed: ${err.message}. Falling back to embedded memory store.`);
            usePostgres = false;
        }
    } else {
        console.log('[DB] DATABASE_URL not set. Running with embedded in-memory database.');
        usePostgres = false;
    }
}

/**
 * Helper to execute raw SQL when running on Postgres
 */
async function query(text, params = []) {
    if (usePostgres && pool) {
        return pool.query(text, params);
    }
    throw new Error('Raw query not supported in memory store mode');
}

// --------------------------------------------------------------------------
// Database Repository Functions
// --------------------------------------------------------------------------

async function getUserByUsername(username) {
    if (usePostgres && pool) {
        const res = await pool.query('SELECT * FROM users WHERE LOWER(username) = LOWER($1)', [username]);
        return res.rows[0] || null;
    }
    return memoryStore.users.find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
}

async function getUserById(id) {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return null;

    if (usePostgres && pool) {
        const res = await pool.query('SELECT * FROM users WHERE id = $1', [numId]);
        return res.rows[0] || null;
    }
    return memoryStore.users.find(u => u.id === numId) || null;
}

async function getAllUsers() {
    if (usePostgres && pool) {
        const res = await pool.query('SELECT id, username, full_name, email, role, metadata, created_at FROM users ORDER BY id ASC');
        return res.rows;
    }
    return memoryStore.users.map(({ password, ...u }) => ({ ...u }));
}

async function createUser({ username, password, full_name = '', email = '', role = 'user', metadata = {} }) {
    if (usePostgres && pool) {
        const res = await pool.query(
            'INSERT INTO users (username, password, full_name, email, role, metadata) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [username, password, full_name, email, role, JSON.stringify(metadata)]
        );
        return res.rows[0];
    }
    const newUser = {
        id: memoryStore.nextUserId++,
        username,
        password,
        full_name,
        email,
        role,
        metadata,
        created_at: new Date()
    };
    memoryStore.users.push(newUser);
    return newUser;
}

async function updateUser(id, updates) {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return null;

    if (usePostgres && pool) {
        const currentUser = await getUserById(numId);
        if (!currentUser) return null;

        const fullName = updates.full_name !== undefined ? updates.full_name : currentUser.full_name;
        const email = updates.email !== undefined ? updates.email : currentUser.email;
        const role = updates.role !== undefined ? updates.role : currentUser.role;
        const metadata = updates.metadata !== undefined ? updates.metadata : currentUser.metadata;

        const res = await pool.query(
            'UPDATE users SET full_name = $1, email = $2, role = $3, metadata = $4 WHERE id = $5 RETURNING *',
            [fullName, email, role, JSON.stringify(metadata), numId]
        );
        return res.rows[0] || null;
    }

    const user = memoryStore.users.find(u => u.id === numId);
    if (!user) return null;
    if (updates.full_name !== undefined) user.full_name = updates.full_name;
    if (updates.email !== undefined) user.email = updates.email;
    if (updates.role !== undefined) user.role = updates.role;
    if (updates.metadata !== undefined) user.metadata = { ...user.metadata, ...updates.metadata };
    return user;
}

async function updateUserPassword(id, hashedPassword) {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return null;

    if (usePostgres && pool) {
        const res = await pool.query('UPDATE users SET password = $1 WHERE id = $2 RETURNING *', [hashedPassword, numId]);
        return res.rows[0] || null;
    }
    const user = memoryStore.users.find(u => u.id === numId);
    if (!user) return null;
    user.password = hashedPassword;
    return user;
}

async function getNotesByUserId(userId) {
    const numId = parseInt(userId, 10);
    if (usePostgres && pool) {
        const res = await pool.query('SELECT * FROM notes WHERE user_id = $1 ORDER BY id ASC', [numId]);
        return res.rows;
    }
    return memoryStore.notes.filter(n => n.user_id === numId);
}

async function getNoteById(id) {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return null;

    if (usePostgres && pool) {
        const res = await pool.query(
            `SELECT n.*, u.username as owner_username, u.full_name as owner_name 
             FROM notes n 
             JOIN users u ON n.user_id = u.id 
             WHERE n.id = $1`,
            [numId]
        );
        return res.rows[0] || null;
    }

    const note = memoryStore.notes.find(n => n.id === numId);
    if (!note) return null;
    const owner = memoryStore.users.find(u => u.id === note.user_id);
    return {
        ...note,
        owner_username: owner ? owner.username : 'unknown',
        owner_name: owner ? owner.full_name : 'Unknown'
    };
}

async function getNoteByUuid(uuid) {
    if (!uuid) return null;

    if (usePostgres && pool) {
        const res = await pool.query(
            `SELECT n.*, u.username as owner_username, u.full_name as owner_name 
             FROM notes n 
             JOIN users u ON n.user_id = u.id 
             WHERE n.uuid = $1`,
            [uuid]
        );
        return res.rows[0] || null;
    }

    const note = memoryStore.notes.find(n => n.uuid === uuid);
    if (!note) return null;
    const owner = memoryStore.users.find(u => u.id === note.user_id);
    return {
        ...note,
        owner_username: owner ? owner.username : 'unknown',
        owner_name: owner ? owner.full_name : 'Unknown'
    };
}

async function createNote({ uuid, user_id, title, content, is_private = true }) {
    if (usePostgres && pool) {
        const res = await pool.query(
            'INSERT INTO notes (uuid, user_id, title, content, is_private) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [uuid, user_id, title, content, is_private]
        );
        return res.rows[0];
    }
    const newNote = {
        id: memoryStore.nextNoteId++,
        uuid,
        user_id,
        title,
        content,
        is_private,
        created_at: new Date()
    };
    memoryStore.notes.push(newNote);
    return newNote;
}

async function deleteNote(id) {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return null;

    if (usePostgres && pool) {
        const res = await pool.query('DELETE FROM notes WHERE id = $1 RETURNING *', [numId]);
        return res.rows[0] || null;
    }
    const idx = memoryStore.notes.findIndex(n => n.id === numId);
    if (idx === -1) return null;
    return memoryStore.notes.splice(idx, 1)[0];
}

async function getActivity(limit = 10) {
    if (usePostgres && pool) {
        const res = await pool.query(
            `SELECT a.*, u.username 
             FROM audit_logs a 
             LEFT JOIN users u ON a.user_id = u.id 
             ORDER BY a.created_at DESC 
             LIMIT $1`,
            [limit]
        );
        return res.rows;
    }
    return [...memoryStore.audit_logs]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, limit);
}

async function logActivity(userId, action, details, noteUuid = null) {
    if (usePostgres && pool) {
        await pool.query(
            'INSERT INTO audit_logs (user_id, action, details, note_uuid) VALUES ($1, $2, $3, $4)',
            [userId, action, details, noteUuid]
        );
        return;
    }
    const user = memoryStore.users.find(u => u.id === userId);
    memoryStore.audit_logs.unshift({
        id: memoryStore.nextLogId++,
        user_id: userId,
        username: user ? user.username : 'system',
        action,
        details,
        note_uuid: noteUuid,
        created_at: new Date()
    });
}

function isPostgres() {
    return usePostgres;
}

module.exports = {
    initDb,
    query,
    getUserByUsername,
    getUserById,
    getAllUsers,
    createUser,
    updateUser,
    updateUserPassword,
    getNotesByUserId,
    getNoteById,
    getNoteByUuid,
    createNote,
    deleteNote,
    getActivity,
    logActivity,
    isPostgres
};
