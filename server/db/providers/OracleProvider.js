const BaseProvider = require('./BaseProvider');
const oracledb = require('oracledb');

// Enable auto-commit for simplified transaction management in this context
oracledb.autoCommit = true;

class OracleProvider extends BaseProvider {
    constructor(config) {
        super(config);
        this.connection = null;
    }

    async connect() {
        try {
            const connectionString = `${this.config.host}:${this.config.port || 1521}/${this.config.database}`;

            this.connection = await oracledb.getConnection({
                user: this.config.user,
                password: this.config.password,
                connectString: connectionString
            });
            console.log('Connected to Oracle database');
        } catch (err) {
            console.error('Oracle connection error:', err);
            throw err;
        }
    }

    parseQuery(text) {
        // Oracle uses :1, :2, etc. or named parameters.
        // Converting $1, $2 to :1, :2
        return text.replace(/\$(\d+)/g, ':$1');
    }

    async query(text, params = []) {
        if (!this.connection) {
            throw new Error('Database not connected');
        }

        const sql = this.parseQuery(text);

        try {
            const result = await this.connection.execute(sql, params, {
                outFormat: oracledb.OUT_FORMAT_OBJECT
            });

            // Normalize rows to be array of objects
            // Oracle returns rows as objects if outFormat is OBJECT
            return {
                rows: result.rows || [],
                rowCount: result.rows ? result.rows.length : 0
            };
        } catch (err) {
            console.error('Oracle query error:', err);
            throw err;
        }
    }

    async close() {
        if (this.connection) {
            try {
                await this.connection.close();
            } catch (err) {
                console.error('Error closing Oracle connection:', err);
            }
            this.connection = null;
        }
    }
}

module.exports = OracleProvider;
