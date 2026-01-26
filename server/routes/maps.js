const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateAdmin } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// Get all maps
router.get('/', authenticateAdmin, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT m.*, (SELECT COUNT(*) FROM map_layers ml WHERE ml.map_id = m.id) as layer_count 
            FROM maps m 
            ORDER BY m.created_at DESC
        `);
        const maps = result.rows.map(m => ({
            ...m,
            config: typeof m.config === 'string' ? JSON.parse(m.config) : m.config
        }));
        res.json(maps);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get single map with layers
router.get('/:id', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const mapResult = await db.query('SELECT * FROM maps WHERE id = $1', [id]);
        if (mapResult.rows.length === 0) return res.status(404).json({ error: 'Map not found' });

        const layersResult = await db.query(`
            SELECT l.*, ml.z_index, ml.opacity, ml.visible
            FROM layers l
            JOIN map_layers ml ON l.id = ml.layer_id
            WHERE ml.map_id = $1
            ORDER BY ml.z_index
        `, [id]);

        const map = mapResult.rows[0];
        const layers = layersResult.rows.map(l => ({
            ...l,
            params: typeof l.params === 'string' ? JSON.parse(l.params) : l.params
        }));

        // Get assigned basemaps
        const basemapsResult = await db.query(`
            SELECT b.*, mb.is_default
            FROM basemaps b
            JOIN map_basemaps mb ON b.id = mb.basemap_id
            WHERE mb.map_id = $1
        `, [id]);

        res.json({
            ...map,
            config: typeof map.config === 'string' ? JSON.parse(map.config) : map.config,
            layers: layers,
            basemaps: basemapsResult.rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create a new map
router.post('/', authenticateAdmin, async (req, res) => {
    const { title, description, config, projection, layers } = req.body;
    const mapId = uuidv4();
    try {
        await db.query('BEGIN TRANSACTION');
        await db.query(
            'INSERT INTO maps (id, title, description, config, projection) VALUES ($1, $2, $3, $4, $5)',
            [mapId, title, description, typeof config === 'string' ? config : JSON.stringify(config), projection || 'EPSG:3857']
        );

        if (layers && layers.length > 0) {
            for (let i = 0; i < layers.length; i++) {
                const l = layers[i];
                await db.query(
                    'INSERT INTO map_layers (map_id, layer_id, z_index, opacity, visible) VALUES ($1, $2, $3, $4, $5)',
                    [mapId, l.id, l.z_index || i, l.opacity || 1.0, l.visible !== false ? 1 : 0]
                );
            }
        }

        if (req.body.basemaps && req.body.basemaps.length > 0) {
            for (const b of req.body.basemaps) {
                await db.query(
                    'INSERT INTO map_basemaps (map_id, basemap_id, is_default) VALUES ($1, $2, $3)',
                    [mapId, b.id, b.is_default ? 1 : 0]
                );
            }
        }
        await db.query('COMMIT');
        const result = await db.query('SELECT * FROM maps WHERE id = $1', [mapId]);
        const map = result.rows[0];
        if (map) {
            map.config = typeof map.config === 'string' ? JSON.parse(map.config) : map.config;
        }
        res.status(201).json(map);
    } catch (err) {
        try { await db.query('ROLLBACK'); } catch (e) { }
        res.status(500).json({ error: err.message });
    }
});

// Update a map
router.put('/:id', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    const { title, description, config, projection, layers } = req.body;
    try {
        await db.query('BEGIN TRANSACTION');

        // Update map details
        await db.query(
            'UPDATE maps SET title = $1, description = $2, config = $3, projection = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5',
            [title, description, typeof config === 'string' ? config : JSON.stringify(config), projection || 'EPSG:3857', id]
        );

        // Replace layers
        await db.query('DELETE FROM map_layers WHERE map_id = $1', [id]);

        if (layers && layers.length > 0) {
            for (let i = 0; i < layers.length; i++) {
                const l = layers[i];
                await db.query(
                    'INSERT INTO map_layers (map_id, layer_id, z_index, opacity, visible) VALUES ($1, $2, $3, $4, $5)',
                    [id, l.id, l.z_index || i, l.opacity || 1.0, l.visible !== false ? 1 : 0]
                );
            }
        }

        // Replace basemaps
        await db.query('DELETE FROM map_basemaps WHERE map_id = $1', [id]);
        if (req.body.basemaps && req.body.basemaps.length > 0) {
            for (const b of req.body.basemaps) {
                await db.query(
                    'INSERT INTO map_basemaps (map_id, basemap_id, is_default) VALUES ($1, $2, $3)',
                    [id, b.id, b.is_default ? 1 : 0]
                );
            }
        }

        await db.query('COMMIT');

        const result = await db.query('SELECT * FROM maps WHERE id = $1', [id]);
        const map = result.rows[0];
        if (map) {
            map.config = typeof map.config === 'string' ? JSON.parse(map.config) : map.config;
        }
        res.json(map);
    } catch (err) {
        try { await db.query('ROLLBACK'); } catch (e) { }
        res.status(500).json({ error: err.message });
    }
});

// Delete a map
router.delete('/:id', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM maps WHERE id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Clone a map
router.post('/:id/clone', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    const newMapId = uuidv4();

    try {
        await db.query('BEGIN TRANSACTION');

        // Fetch original map
        const mapResult = await db.query('SELECT * FROM maps WHERE id = $1', [id]);
        if (mapResult.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Map not found' });
        }
        const originalMap = mapResult.rows[0];

        // Create duplicate map
        await db.query(
            'INSERT INTO maps (id, title, description, config, projection) VALUES ($1, $2, $3, $4, $5)',
            [
                newMapId,
                `${originalMap.title} - Copy`,
                originalMap.description,
                originalMap.config, // Already string in DB
                originalMap.projection
            ]
        );

        // Copy Layers
        const layersResult = await db.query('SELECT * FROM map_layers WHERE map_id = $1', [id]);
        for (const layer of layersResult.rows) {
            await db.query(
                'INSERT INTO map_layers (map_id, layer_id, z_index, opacity, visible) VALUES ($1, $2, $3, $4, $5)',
                [newMapId, layer.layer_id, layer.z_index, layer.opacity, layer.visible]
            );
        }

        // Copy Basemaps
        const basemapsResult = await db.query('SELECT * FROM map_basemaps WHERE map_id = $1', [id]);
        for (const basemap of basemapsResult.rows) {
            await db.query(
                'INSERT INTO map_basemaps (map_id, basemap_id, is_default) VALUES ($1, $2, $3)',
                [newMapId, basemap.basemap_id, basemap.is_default]
            );
        }

        await db.query('COMMIT');

        const result = await db.query('SELECT * FROM maps WHERE id = $1', [newMapId]);
        const newMap = result.rows[0];
        if (newMap) {
            newMap.config = typeof newMap.config === 'string' ? JSON.parse(newMap.config) : newMap.config;
        }
        res.status(201).json(newMap);

    } catch (err) {
        try { await db.query('ROLLBACK'); } catch (e) { }
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
