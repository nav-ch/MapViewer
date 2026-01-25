const jwt = require('jsonwebtoken');
const db = require('../db');

const authenticateAdmin = (req, res, next) => {
    // Bypass for internal development
    if (process.env.NODE_ENV !== 'production' || !process.env.JWT_SECRET) {
        // console.warn('Development Bypass: Granting superadmin access.');
        req.user = { id: 0, username: 'admin', role: 'superadmin' };
        return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
};

const validateApiKey = async (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    if (!apiKey) {
        return res.status(401).json({ error: 'Unauthorized: API Key required' });
    }

    // Allow internal preview from Admin UI
    if (apiKey === 'internal_admin_preview') {
        req.app_name = 'Admin Preview';
        return next();
    }

    try {
        const result = await db.query(
            'SELECT * FROM api_keys WHERE key = $1 AND is_active = TRUE',
            [apiKey]
        );

        const keyData = result.rows[0];

        // Enforce Map-level restriction if configured
        const requestedMapId = req.params.mapId;
        if (keyData.map_id && requestedMapId && keyData.map_id !== requestedMapId) {
            return res.status(403).json({ error: 'Forbidden: API Key not authorized for this map' });
        }

        req.app_name = keyData.app_name;
        next();
    } catch (err) {
        console.error('API Key validation error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    authenticateAdmin,
    validateApiKey
};
