-- VulnLab Notes CTF - PostgreSQL 16 Schema and Seed Data
-- Database: notes_db

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    email VARCHAR(100),
    role VARCHAR(20) DEFAULT 'user',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notes (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(64) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_private BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    note_uuid VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Clear existing data if needed
TRUNCATE TABLE audit_logs, notes, users RESTART IDENTITY CASCADE;

-- Passwords:
-- admin: AdminSecretPass2026!
-- alice: alice123
-- bob: bob123
INSERT INTO users (id, username, password, full_name, email, role, metadata) VALUES
(1, 'admin', '$2b$10$L8zL3CgoOgCxQbtLc1GpK.FgnTejBwAIvcKqu68xyZro5K5L0pY1a', 'System Administrator', 'admin@vulnlab.local', 'admin', '{"department": "Security Ops", "clearance": "Level 5"}'),
(2, 'alice', '$2b$10$BankjGnqH14.PRE5e2K53u/3JCTzoTEvnz2W574Tycu8G3fA3Krv.', 'Alice Smith', 'alice@vulnlab.local', 'user', '{"department": "Engineering", "team": "Core"}'),
(3, 'bob', '$2b$10$ipAC8AazXida4iFpqOAfduIkelF2q0qA8ymXoPzbem5Mq7u9eYxSa', 'Bob Jones', 'bob@vulnlab.local', 'user', '{"department": "QA", "team": "Automation"}');

-- Reset users sequence
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

-- Seed Notes
INSERT INTO notes (id, uuid, user_id, title, content, is_private) VALUES
(1, 'a1b2c3d4-e5f6-4789-9abc-def012345678', 1, 'Executive Confidential - CTF System Secret', 'CONFIDENTIAL EXECUTIVE MEMO: System maintenance token and flag placeholder. Access restricted.', TRUE),
(2, 'f5e4d3c2-b1a0-4987-8cba-fed987654321', 1, 'VulnLab Notes Platform Guidelines', 'Welcome to SecureNotes Internal Portal! All internal confidential notes are encrypted at rest and accessible only by authorized personnel.', FALSE),
(3, 'b2c3d4e5-f6a7-4890-abcd-ef0123456789', 2, 'Alice Grocery List', '1. Organic Apples\n2. Almond Milk\n3. Whole Wheat Sourdough\n4. Dark Roast Coffee\n5. Greek Yogurt', TRUE),
(4, 'c3d4e5f6-a7b8-4901-bcde-f0123456789a', 2, 'Alice Q4 Security Roadmap', 'Key Focus Areas:\n- Audit authorization middleware on all routes\n- Enforce strict parameter validation\n- Prevent mass assignment in user profiles\n- Remove internal audit leaks', FALSE),
(5, 'd4e5f6a7-b8c9-4012-cdef-0123456789ab', 3, 'Bob Personal Sprint Tasks', 'Sprint 42 Checklist:\n1. Update automated API test suites\n2. Verify session cookie SameSite and HttpOnly flags\n3. Clean up legacy migration scripts', TRUE);

-- Reset notes sequence
SELECT setval('notes_id_seq', (SELECT MAX(id) FROM notes));

-- Seed Audit Logs
INSERT INTO audit_logs (id, user_id, action, details, note_uuid) VALUES
(1, 1, 'NOTE_CREATED', 'Admin created note: Executive Confidential - CTF System Secret', 'a1b2c3d4-e5f6-4789-9abc-def012345678'),
(2, 1, 'SYSTEM_MAINTENANCE', 'Automated database vacuum and security audit completed', NULL),
(3, 2, 'NOTE_CREATED', 'Alice created note: Alice Grocery List', 'b2c3d4e5-f6a7-4890-abcd-ef0123456789'),
(4, 2, 'NOTE_CREATED', 'Alice created note: Alice Q4 Security Roadmap', 'c3d4e5f6-a7b8-4901-bcde-f0123456789a'),
(5, 3, 'NOTE_CREATED', 'Bob created note: Bob Personal Sprint Tasks', 'd4e5f6a7-b8c9-4012-cdef-0123456789ab');

-- Reset audit_logs sequence
SELECT setval('audit_logs_id_seq', (SELECT MAX(id) FROM audit_logs));
