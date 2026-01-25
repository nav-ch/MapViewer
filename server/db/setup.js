const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

const schema = `
-- Layers configuration
CREATE TABLE IF NOT EXISTS layers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    url TEXT NOT NULL,
    params TEXT DEFAULT '{}',
    is_editable INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Maps configuration
CREATE TABLE IF NOT EXISTS maps (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    config TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Junction table for Maps and Layers
CREATE TABLE IF NOT EXISTS map_layers (
    map_id TEXT REFERENCES maps(id) ON DELETE CASCADE,
    layer_id TEXT REFERENCES layers(id) ON DELETE CASCADE,
    z_index INTEGER DEFAULT 0,
    opacity FLOAT DEFAULT 1.0,
    visible INTEGER DEFAULT 1,
    PRIMARY KEY (map_id, layer_id)
);

-- API Keys for external application access
CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    app_name TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

db.serialize(() => {
    db.exec(schema, (err) => {
        if (err) {
            console.error('Error creating tables:', err);
            return;
        }
        console.log('Tables created successfully.');

        // Seed data
        const l1 = uuidv4();
        const l2 = uuidv4();
        const l3 = uuidv4();
        const m1 = uuidv4();

        db.run("INSERT OR IGNORE INTO layers (id, name, type, url, params, is_editable) VALUES (?, ?, ?, ?, ?, ?)",
            [l1, 'Vegetation Index', 'WMS', 'https://demo.boundary.org/geoserver/wms', '{}', 1]);
        db.run("INSERT OR IGNORE INTO layers (id, name, type, url, params, is_editable) VALUES (?, ?, ?, ?, ?, ?)",
            [l2, 'Sales Regions', 'WFS', 'https://api.mapviewer.com/features', '{}', 0]);
        db.run("INSERT OR IGNORE INTO layers (id, name, type, url, params, is_editable) VALUES (?, ?, ?, ?, ?, ?)",
            [l3, 'Topography', 'XYZ', 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', '{}', 0]);

        db.run("INSERT OR IGNORE INTO maps (id, title, description, config) VALUES (?, ?, ?, ?)",
            [m1, 'Global Sales Map', 'Overview of all regions', JSON.stringify({ zoom: 2, center: [0, 0] })]);

        db.run("INSERT OR IGNORE INTO map_layers (map_id, layer_id, z_index, opacity, visible) VALUES (?, ?, ?, ?, ?)",
            [m1, l1, 0, 0.8, 1]);
        db.run("INSERT OR IGNORE INTO map_layers (map_id, layer_id, z_index, opacity, visible) VALUES (?, ?, ?, ?, ?)",
            [m1, l3, 1, 1.0, 1]);

        db.run("INSERT OR IGNORE INTO api_keys (id, key, app_name, is_active) VALUES (?, ?, ?, ?)",
            [uuidv4(), 'internal_admin_preview', 'Admin Preview', 1]);

        console.log('Seed data inserted.');
        db.close();
    });
});
