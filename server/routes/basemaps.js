const express = require('express');
const router = express.Router();
const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const { authenticateAdmin } = require('../middleware/auth');

// Get all basemaps
router.get('/', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM basemaps ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create basemap
router.post('/', authenticateAdmin, async (req, res) => {
    const { name, type, url, params } = req.body;
    const id = uuidv4();
    try {
        await db.query(
            'INSERT INTO basemaps (id, name, type, url, params) VALUES ($1, $2, $3, $4, $5)',
            [id, name, type, url, typeof params === 'string' ? params : JSON.stringify(params)]
        );
        res.status(201).json({ id, name, type, url, params });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update basemap
router.put('/:id', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, type, url, params } = req.body;
    try {
        await db.query(
            'UPDATE basemaps SET name = $1, type = $2, url = $3, params = $4 WHERE id = $5',
            [name, type, url, typeof params === 'string' ? params : JSON.stringify(params), id]
        );
        res.json({ message: 'Basemap updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete basemap
router.delete('/:id', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM basemaps WHERE id = $1', [id]);
        res.json({ message: 'Basemap deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
