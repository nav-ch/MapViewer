const BaseProvider = require('./BaseProvider');
const mysql = require('mysql2/promise');

class MySQLProvider extends BaseProvider {
    constructor(config) {
        super(config);
        this.connection = null;
    }

    async connect() {
        try {
            this.connection = await mysql.createConnection({
                host: this.config.host,
                port: this.config.port || 3306,
                user: this.config.user,
                password: this.config.password,
                database: this.config.database,
                ssl: this.config.ssl ? { rejectUnauthorized: false } : undefined
            });
            console.log('Connected to MySQL database');
        } catch (err) {
            console.error('MySQL connection error:', err);
            throw err;
        }
    }

    parseQuery(text) {
        // MySQL uses ? for parameters, but our base might expect $1, $2 etc if we standardized on PG style
        // For now, let's assume the query text passed in is already compatible or we need a converter.
        // If the app uses $1 syntax, we need to convert to ?
        // Simple regex replace for now, assuming strictly $1, $2... order
        return text.replace(/\$\d+/g, '?');
    }

    async query(text, params = []) {
        if (!this.connection) {
            throw new Error('Database not connected');
        }

        const sql = this.parseQuery(text);

        try {
            const [rows, fields] = await this.connection.execute(sql, params);
            return { rows, rowCount: rows.length };
        } catch (err) {
            console.error('MySQL query error:', err);
            throw err;
        }
    }

    async close() {
        if (this.connection) {
            await this.connection.end();
            this.connection = null;
        }
    }
}

module.exports = MySQLProvider;
