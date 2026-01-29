-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Users table for Admin UI access
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Layers configuration
CREATE TABLE IF NOT EXISTS layers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'wms', 'wfs', 'arcgis_rest', 'wmts', etc.
    url TEXT NOT NULL,
    params JSONB DEFAULT '{}', -- Additional parameters like layers, styles, format
    is_editable BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Maps configuration (containers for layers)
CREATE TABLE IF NOT EXISTS maps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    config JSONB DEFAULT '{}', -- Global map config like initial zoom, center
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Junction table for Maps and Layers
CREATE TABLE IF NOT EXISTS map_layers (
    map_id UUID REFERENCES maps(id) ON DELETE CASCADE,
    layer_id UUID REFERENCES layers(id) ON DELETE CASCADE,
    z_index INTEGER DEFAULT 0,
    opacity FLOAT DEFAULT 1.0,
    visible BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (map_id, layer_id)
);

-- API Keys for external application access
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    app_name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Junction table for API Keys and Maps
CREATE TABLE IF NOT EXISTS api_key_maps (
    api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
    map_id UUID REFERENCES maps(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (api_key_id, map_id)
);
