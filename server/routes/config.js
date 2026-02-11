const express = require('express');
const router = express.Router();
const { loadConfig, saveConfig } = require('../config/database');
const MigrationManager = require('../db/MigrationManager');
const db = require('../db');
const { authenticateAdmin } = require('../middleware/auth');
const PostgresProvider = require('../db/providers/PostgresProvider');
// const MySQLProvider = require('../db/providers/MySQLProvider');

// Get current configuration
router.get('/', authenticateAdmin, (req, res) => {
    const config = loadConfig();
    // Mask password
    if (config.password) {
        config.password = '********';
    }
    res.json(config);
});

// Test connection
router.post('/test', authenticateAdmin, async (req, res) => {
    const config = req.body;
    let provider;

    try {
        if (config.type === 'postgres') {
            provider = new PostgresProvider(config);
        } else if (config.type === 'mysql') {
            provider = new (require('../db/providers/MySQLProvider'))(config);
        } else if (config.type === 'oracle') {
            provider = new (require('../db/providers/OracleProvider'))(config);
        } else if (config.type === 'mssql') {
            provider = new (require('../db/providers/MSSQLProvider'))(config);
        } else {
            return res.status(400).json({ error: 'Unsupported database type for testing' });
        }

        await provider.connect();
        const success = await provider.testConnection();
        await provider.close();

        if (success) {
            res.json({ success: true, message: 'Connection successful' });
        } else {
            res.status(400).json({ success: false, error: 'Connection test failed' });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Migrate Data
router.post('/migrate', authenticateAdmin, async (req, res) => {
    const targetConfig = req.body;
    try {
        // Create a temporary provider to test target connection first
        // Then run migration
        await MigrationManager.migrate(targetConfig);
        res.json({ success: true, message: 'Migration completed successfully' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Save Configuration
router.post('/', authenticateAdmin, async (req, res) => {
    const newConfig = req.body;

    // Validate?

    try {
        saveConfig(newConfig);

        // Retrigger DB provider reload?
        // The db module initializes on load. We might need a generic method to reload.
        // But simpler to just ask user to restart, OR we force a process exit to restart if managed by PM2/Docker
        // OR we expose a reload method in db/index.js

        // Let's assume we want hot-reload if possible
        if (GlobalDB) { // We can export a reload function from db module
            // But requiring db here creates circular dependency potentially? No, db requires config, config doesn't require db.
            // Routes require db.
        }

        res.json({ success: true, message: 'Configuration saved. Please restart the server to apply changes.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
