const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateAdmin } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// Get all API keys with map info
router.get('/', authenticateAdmin, async (req, res) => {
    try {
        // We use GROUP_CONCAT to get comma-separated lists of IDs and Titles
        // Note: SQLite GROUP_CONCAT returns a string
        const result = await db.query(`
            SELECT k.*, 
                   GROUP_CONCAT(m.id) as map_ids,
                   GROUP_CONCAT(m.title) as map_titles
            FROM api_keys k
            LEFT JOIN api_key_maps akm ON k.id = akm.api_key_id
            LEFT JOIN maps m ON akm.map_id = m.id
            GROUP BY k.id
            ORDER BY k.created_at DESC
        `);

        const keys = result.rows.map(row => ({
            ...row,
            // Convert comma-separated strings back to arrays
            map_ids: row.map_ids ? row.map_ids.split(',') : [],
            map_titles: row.map_titles ? row.map_titles.split(',') : [],
            // specific map_id compatibility (legacy support or if we still keep the column)
            map_id: row.map_ids ? row.map_ids.split(',')[0] : null
        }));

        res.json(keys);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create an API key
router.post('/', authenticateAdmin, async (req, res) => {
    const { app_name, map_ids = [], expires_at = null, allowed_hosts = '' } = req.body;
    const id = uuidv4();
    const key = uuidv4();

    try {
        // Insert into api_keys
        await db.query(
            'INSERT INTO api_keys (id, key, app_name, is_active, expires_at, allowed_hosts) VALUES (?, ?, ?, ?, ?, ?)',
            [id, key, app_name, 1, expires_at, allowed_hosts]
        );

        // Insert into api_key_maps
        if (Array.isArray(map_ids) && map_ids.length > 0) {
            for (const mapId of map_ids) {
                await db.query(
                    'INSERT INTO api_key_maps (api_key_id, map_id) VALUES (?, ?)',
                    [id, mapId]
                );
            }
        }

        // Fetch back cleanly
        const result = await db.query(`
            SELECT k.*, 
                   GROUP_CONCAT(m.id) as map_ids,
                   GROUP_CONCAT(m.title) as map_titles
            FROM api_keys k
            LEFT JOIN api_key_maps akm ON k.id = akm.api_key_id
            LEFT JOIN maps m ON akm.map_id = m.id
            WHERE k.id = ?
            GROUP BY k.id
        `, [id]);

        const newKey = result.rows[0];
        if (newKey) {
            newKey.map_ids = newKey.map_ids ? newKey.map_ids.split(',') : [];
            newKey.map_titles = newKey.map_titles ? newKey.map_titles.split(',') : [];
        }

        res.status(201).json(newKey);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update an API key
router.put('/:id', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    const { app_name, map_ids = [], is_active, expires_at, allowed_hosts } = req.body;

    try {
        // Update main record
        await db.query(
            'UPDATE api_keys SET app_name = ?, is_active = ?, expires_at = ?, allowed_hosts = ? WHERE id = ?',
            [app_name, is_active ? 1 : 0, expires_at, allowed_hosts, id]
        );

        // Update maps: Delete all existing and re-insert
        await db.query('DELETE FROM api_key_maps WHERE api_key_id = ?', [id]);

        if (Array.isArray(map_ids) && map_ids.length > 0) {
            for (const mapId of map_ids) {
                await db.query(
                    'INSERT INTO api_key_maps (api_key_id, map_id) VALUES (?, ?)',
                    [id, mapId]
                );
            }
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Deactivate/Delete an API key
router.delete('/:id', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM api_keys WHERE id = ?', [id]);
        // api_key_maps should cascade delete if schema is correct, otherwise we should delete manually
        // But since we using PRAGMA foreign_keys = ON usually in SQLite, it should work? 
        // index.ts didn't explicitly enable foreign keys, let's delete manually to be safe or just rely on the constraints if they work.
        // But to be safe manually deleting from specific table isn't needed if we trust the wrapper or adding explicit delete.
        // Actually, schema said ON DELETE CASCADE. SQLite needs `PRAGMA foreign_keys = ON;` to enforce it.
        // I'll add a manual delete just in case foreign keys aren't enabled.
        await db.query('DELETE FROM api_key_maps WHERE api_key_id = ?', [id]);

        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
