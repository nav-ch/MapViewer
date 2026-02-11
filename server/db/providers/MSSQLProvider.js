const BaseProvider = require('./BaseProvider');
const sql = require('mssql');

class MSSQLProvider extends BaseProvider {
    constructor(config) {
        super(config);
        this.pool = null;
    }

    async connect() {
        try {
            const sqlConfig = {
                user: this.config.user,
                password: this.config.password,
                database: this.config.database,
                server: this.config.host,
                port: parseInt(this.config.port) || 1433,
                pool: {
                    max: 10,
                    min: 0,
                    idleTimeoutMillis: 30000
                },
                options: {
                    encrypt: this.config.ssl || false,
                    trustServerCertificate: true // Useful for self-signed certs (dev/local)
                }
            };

            this.pool = await sql.connect(sqlConfig);
            console.log('Connected to SQL Server');
        } catch (err) {
            console.error('SQL Server connection error:', err);
            throw err;
        }
    }

    parseQuery(text) {
        // MSSQL uses @param or just works with input? 
        // mssql library supports @param but for simple parameterized queries we might need usage of inputs.
        // However, `pool.request().query` takes a string. 
        // Standard `mssql` usage often involves `input` definitions.
        // To support a generic `query(text, params)` resembling `pg`, we might need to handle parameter substitution manually or use `input`.

        // Strategy: Convert $1, $2 to @p1, @p2 and bind inputs.
        // But `input` requires name and type.
        // Quick & dirty for this generic interface: simple replacement might vary.
        // Let's stick with @p0, @p1... and rely on order if we mapped it.

        // Actually, mssql `query` function directly doesn't support array params easily without `input`.
        // We will loop params and add them as input.
        return text.replace(/\$(\d+)/g, (match, number) => `@p${number - 1}`); // $1 -> @p0
    }

    async query(text, params = []) {
        if (!this.pool) {
            throw new Error('Database not connected');
        }

        try {
            const request = this.pool.request();

            // Bind parameters
            params.forEach((val, index) => {
                request.input(`p${index}`, val);
            });

            const sqlQuery = this.parseQuery(text);
            const result = await request.query(sqlQuery);

            return {
                rows: result.recordset,
                rowCount: result.rowsAffected[0]
            };
        } catch (err) {
            console.error('SQL Server query error:', err);
            throw err;
        }
    }

    async close() {
        if (this.pool) {
            await this.pool.close();
            this.pool = null;
        }
    }
}

module.exports = MSSQLProvider;
