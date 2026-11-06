/**
 * Server Entrypoint
 */

const app = require('./app');
const db = require('./db');
const { PORT, getDifficulty } = require('./config');

async function startServer() {
    try {
        console.log('[Server] Initializing database layer...');
        await db.initDb();

        const server = app.listen(PORT, () => {
            const currentDiff = getDifficulty();
            console.log(`=================================================`);
            console.log(`  VulnLab CTF - notes-idor service`);
            console.log(`  Port:             ${PORT}`);
            console.log(`  Default Diff:     ${currentDiff.toUpperCase()}`);
            console.log(`  Database Engine:  ${db.isPostgres() ? 'PostgreSQL 16' : 'In-Memory Fallback'}`);
            console.log(`  Healthcheck:      http://127.0.0.1:${PORT}/health`);
            console.log(`=================================================`);
        });

        // Graceful shutdown handling
        const shutdown = () => {
            console.log('\n[Server] Received shutdown signal. Closing server...');
            server.close(() => {
                console.log('[Server] Process terminated cleanly.');
                process.exit(0);
            });
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
    } catch (err) {
        console.error('[Server] Fatal startup error:', err);
        process.exit(1);
    }
}

startServer();
