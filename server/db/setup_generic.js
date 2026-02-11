const db = require('./index');
const fs = require('fs');
const path = require('path');
const { loadConfig } = require('../config/database');

async function setupDatabase() {
    const config = loadConfig();
    const provider = db.getProvider();

    console.log(`Setting up database for ${config.type}...`);

    try {
        if (config.type === 'sqlite') {
            // Original SQLite setup logic
            const schemaPath = path.join(__dirname, 'schema.sql'); // We might need a separate sqlite schema file if syntax differs significantly
            // For now, let's assume schema.sql is compatible or we use a specific one
            // The existing schema.sql uses some PG syntax (CREATE EXTENSION), so we should use a sqlite compatible one or strip it.
            // Let's create a simplified schema for SQLite if needed, or stick to the one embedded in the original setup.js

            // Actually, let's reuse the logic from the original setup.js but adapted for the provider
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

-- Junction table for Map Layers
CREATE TABLE IF NOT EXISTS map_layers (
    map_id TEXT REFERENCES maps(id) ON DELETE CASCADE,
    layer_id TEXT REFERENCES layers(id) ON DELETE CASCADE,
    z_index INTEGER DEFAULT 0,
    opacity FLOAT DEFAULT 1.0,
    visible INTEGER DEFAULT 1,
    PRIMARY KEY (map_id, layer_id)
);

-- API Keys
CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    app_name TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Map Basemaps (Missing in original setup.js reference but present in maps.js usage)
CREATE TABLE IF NOT EXISTS basemaps (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    thumbnail TEXT,
    type TEXT DEFAULT 'XYZ',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS map_basemaps (
    map_id TEXT REFERENCES maps(id) ON DELETE CASCADE,
    basemap_id TEXT REFERENCES basemaps(id) ON DELETE CASCADE,
    is_default INTEGER DEFAULT 0,
    PRIMARY KEY (map_id, basemap_id)
);
`;
            // Execute schema
            const statements = schema.split(';').filter(s => s.trim());
            for (const stmt of statements) {
                await provider.query(stmt);
            }
            console.log('SQLite tables initialized.');

        } else if (config.type === 'postgres') {
            // Postgres Setup
            const schemaContent = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
            // Execute schema
            // Split by commands? Or just run file.
            // PG usually handles multiple statements if supported by driver, but explicitly creating extension requires superuser sometimes.
            // Let's try running it.
            await provider.query(schemaContent);
            console.log('Postgres tables initialized.');
        }

    } catch (err) {
        console.error('Database setup failed:', err);
    }
}

// If run directly
if (require.main === module) {
    setupDatabase().then(() => {
        console.log('Setup complete.');
        process.exit(0);
    });
}

module.exports = setupDatabase;
