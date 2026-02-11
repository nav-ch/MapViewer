class BaseProvider {
    constructor(config) {
        this.config = config;
    }

    /**
     * Connect to the database
     * @returns {Promise<void>}
     */
    async connect() {
        throw new Error('Method not implemented');
    }

    /**
     * Parse SQL query to be compatible with specific provider
     * @param {string} text 
     * @returns {string} provider specific query
     */
    parseQuery(text) {
        return text;
    }

    /**
     * Execute a query
     * @param {string} text SQL query
     * @param {any[]} params Query parameters
     * @returns {Promise<{rows: any[], rowCount: number}>}
     */
    async query(text, params = []) {
        throw new Error('Method not implemented');
    }

    /**
     * Test the connection
     * @returns {Promise<boolean>}
     */
    async testConnection() {
        try {
            await this.query('SELECT 1');

            // Check create privileges
            try {
                const testTable = 'antigravity_test_privs_' + Date.now();
                await this.query(`CREATE TABLE ${testTable} (id INT)`);
                await this.query(`DROP TABLE ${testTable}`);
            } catch (privErr) {
                console.error('Privilege check failed:', privErr);
                throw new Error('Connection successful, but insufficient privileges to CREATE tables. Migration requires CREATE privilege.');
            }

            return true;
        } catch (err) {
            console.error('Connection test failed:', err);
            // Re-throw if it's our custom error, otherwise returns false
            if (err.message.includes('insufficient privileges')) {
                throw err;
            }
            return false;
        }
    }

    /**
     * Close the connection
     * @returns {Promise<void>}
     */
    async close() {
        // Optional
    }
}

module.exports = BaseProvider;
