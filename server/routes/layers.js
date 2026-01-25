const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateAdmin } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// Get all layers
router.get('/', authenticateAdmin, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM layers ORDER BY created_at DESC');
        const rows = result.rows.map(row => ({
            ...row,
            params: typeof row.params === 'string' ? JSON.parse(row.params) : row.params
        }));
        res.json(rows);
    } catch (err) {
        console.error('GET /layers error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Create a layer
router.post('/', authenticateAdmin, async (req, res) => {
    const { name, type, url, params, projection, is_editable } = req.body;
    const id = uuidv4();
    try {
        await db.query(
            'INSERT INTO layers (id, name, type, url, params, projection, is_editable) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [id, name, type, url, JSON.stringify(params || {}), projection || 'EPSG:3857', is_editable ? 1 : 0]
        );
        const result = await db.query('SELECT * FROM layers WHERE id = $1', [id]);
        const row = result.rows[0];
        if (row) {
            row.params = typeof row.params === 'string' ? JSON.parse(row.params) : row.params;
        }
        res.status(201).json(row);
    } catch (err) {
        console.error('POST /layers error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Update a layer
router.put('/:id', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, type, url, params, projection, is_editable } = req.body;
    try {
        await db.query(
            'UPDATE layers SET name = $1, type = $2, url = $3, params = $4, projection = $5, is_editable = $6, updated_at = CURRENT_TIMESTAMP WHERE id = $7',
            [name, type, url, JSON.stringify(params), projection || 'EPSG:3857', is_editable ? 1 : 0, id]
        );
        const result = await db.query('SELECT * FROM layers WHERE id = $1', [id]);
        const row = result.rows[0];
        if (!row) return res.status(404).json({ error: 'Layer not found' });
        row.params = typeof row.params === 'string' ? JSON.parse(row.params) : row.params;
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a layer
router.delete('/:id', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM layers WHERE id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
