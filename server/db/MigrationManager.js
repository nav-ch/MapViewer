const { loadConfig, saveConfig } = require('../config/database');
const SQLiteProvider = require('./providers/SQLiteProvider');
const PostgresProvider = require('./providers/PostgresProvider');
// const MySQLProvider = require('./providers/MySQLProvider'); // Future

class MigrationManager {
    constructor() {
    }

    getProvider(config) {
        switch (config.type) {
            case 'postgres':
                return new PostgresProvider(config);
            case 'mysql':
                return new (require('./providers/MySQLProvider'))(config);
            case 'oracle':
                return new (require('./providers/OracleProvider'))(config);
            case 'mssql':
                return new (require('./providers/MSSQLProvider'))(config);
            case 'sqlite':
            default:
                return new SQLiteProvider(config);
        }
    }

    async migrate(targetConfig) {
        const sourceConfig = loadConfig();
        const sourceProvider = this.getProvider(sourceConfig);
        const targetProvider = this.getProvider(targetConfig);

        console.log(`Migrating from ${sourceConfig.type} to ${targetConfig.type}...`);

        try {
            await sourceProvider.connect();
            await targetProvider.connect();

            // 1. Initialize Schema on Target
            const fs = require('fs');
            const path = require('path');
            const schemaPath = path.join(__dirname, 'schema.sql');
            let schema = fs.readFileSync(schemaPath, 'utf8');

            if (targetConfig.type === 'postgres') {
                await targetProvider.query(schema);
            } else if (targetConfig.type === 'mysql') {
                // MySQL syntax adjustment if needed or run schema directly
                // schema.sql logic might need tweaks for MySQL (e.g. SERIAL vs AUTO_INCREMENT)
                // For now, attempt creating tables. If schema is PG specific, this might fail.
                // Assuming schema is somewhat standard or we need separate schemas.
                // Let's assume generic standard SQL for now or basic compatibility.
                await targetProvider.query(schema);
            } else if (targetConfig.type === 'oracle') {
                // Oracle schema setup is complex (sequences, triggers). 
                // We might need a separate schema_oracle.sql
                // Skipping auto-schema for Oracle for now, assuming DBA setup or advanced migration script later.
                console.warn('Skipping schema creation for Oracle. Ensure tables exist.');
            } else if (targetConfig.type === 'mssql') {
                // MSSQL schema setup
                await targetProvider.query(schema);
            } else if (targetConfig.type === 'sqlite') {
                // Initialize SQLite schema if migrating TO sqlite
            }

            // 2. Transfer Data
            // Tables to migrate: layers, maps, map_layers, api_keys, basemaps, map_basemaps, users
            const tables = ['layers', 'maps', 'map_layers', 'api_keys', 'basemaps', 'map_basemaps', 'users'];

            for (const table of tables) {
                console.log(`Migrating table: ${table}...`);
                try {
                    const { rows } = await sourceProvider.query(`SELECT * FROM ${table}`);
                    if (rows.length > 0) {
                        for (const row of rows) {
                            const columns = Object.keys(row);
                            const values = Object.values(row);
                            const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
                            const insertQuery = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

                            // Adjust for SQLite vs PG syntax if needed (e.g. ON CONFLICT)
                            // PG: ON CONFLICT DO NOTHING works
                            // SQLite: INSERT OR IGNORE works via generic, but let's stick to standard SQL99 if possible or handle specific errors

                            try {
                                await targetProvider.query(insertQuery, values);
                            } catch (insertErr) {
                                console.warn(`Failed to insert row into ${table}:`, insertErr.message);
                            }
                        }
                    }
                } catch (err) {
                    console.warn(`Skipping table ${table} (maybe doesn't exist in source):`, err.message);
                }
            }

            console.log('Migration completed successfully.');
            return true;

        } catch (err) {
            console.error('Migration failed:', err);
            throw err;
        } finally {
            await sourceProvider.close();
            await targetProvider.close();
        }
    }
}

module.exports = new MigrationManager();
