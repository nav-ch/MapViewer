const { Pool } = require('pg');
const BaseProvider = require('./BaseProvider');

class PostgresProvider extends BaseProvider {
    constructor(config) {
        super(config);
        this.pool = new Pool({
            host: config.host,
            port: config.port,
            user: config.user,
            password: config.password,
            database: config.database,
            ssl: config.ssl ? { rejectUnauthorized: false } : false
        });
    }

    async connect() {
        // Pool handles connection automatically, but we can test it here
        await this.pool.query('SELECT 1');
    }

    async query(text, params = []) {
        // PG uses $1, $2, so no need to parse query placeholders if they are already in that format
        const result = await this.pool.query(text, params);
        return {
            rows: result.rows,
            rowCount: result.rowCount
        };
    }

    async close() {
        await this.pool.end();
    }
}

module.exports = PostgresProvider;
