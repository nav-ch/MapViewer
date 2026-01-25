const express = require('express');
const router = express.Router();
const db = require('../db');
const { validateApiKey } = require('../middleware/auth');

// Get map configuration for the viewer
// This endpoint is used by the embeddable plugin
router.get('/:mapId', validateApiKey, async (req, res) => {
    const { mapId } = req.params;
    try {
        const mapResult = await db.query('SELECT title, config, projection FROM maps WHERE id = $1', [mapId]);
        if (mapResult.rows.length === 0) return res.status(404).json({ error: 'Map not found' });

        const layersResult = await db.query(`
            SELECT l.name, l.type, l.url, l.params, l.projection, l.is_editable, ml.z_index, ml.opacity, ml.visible
            FROM layers l
            JOIN map_layers ml ON l.id = ml.layer_id
            WHERE ml.map_id = $1
            ORDER BY ml.z_index
        `, [mapId]);

        const mapData = mapResult.rows[0];
        const layers = layersResult.rows.map(l => ({
            ...l,
            params: typeof l.params === 'string' ? JSON.parse(l.params) : l.params
        }));

        res.json({
            title: mapData.title,
            projection: mapData.projection || 'EPSG:3857',
            config: typeof mapData.config === 'string' ? JSON.parse(mapData.config) : mapData.config,
            layers: layers,
            appName: req.app_name // Passed from validateApiKey middleware
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
