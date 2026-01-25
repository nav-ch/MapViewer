const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateAdmin } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// Get all API keys with map info
router.get('/', authenticateAdmin, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT k.*, m.title as map_title 
            FROM api_keys k
            LEFT JOIN maps m ON k.map_id = m.id
            ORDER BY k.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create an API key
router.post('/', authenticateAdmin, async (req, res) => {
    const { app_name, map_id } = req.body;
    const id = uuidv4();
    const key = uuidv4();
    try {
        await db.query(
            'INSERT INTO api_keys (id, key, app_name, map_id) VALUES ($1, $2, $3, $4)',
            [id, key, app_name, map_id || null]
        );
        const result = await db.query('SELECT * FROM api_keys WHERE id = $1', [id]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update an API key
router.put('/:id', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    const { app_name, map_id, is_active } = req.body;
    try {
        await db.query(
            'UPDATE api_keys SET app_name = $1, map_id = $2, is_active = $3 WHERE id = $4',
            [app_name, map_id || null, is_active ? 1 : 0, id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Deactivate/Delete an API key
router.delete('/:id', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM api_keys WHERE id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
