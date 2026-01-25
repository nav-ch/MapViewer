const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Enable WAL mode for better concurrency
db.run('PRAGMA journal_mode = WAL');

module.exports = {
    /**
     * Compatibility wrapper for PostgreSQL-style queries
     * @param {string} text SQL query
     * @param {any[]} params parameters
     */
    query: (text, params = []) => {
        return new Promise((resolve, reject) => {
            // Convert PG-style placeholders ($1, $2) to SQLite-style (?)
            const sqliteText = text.replace(/\$\d+/g, '?');

            const isSelect = sqliteText.trim().toUpperCase().startsWith('SELECT');

            if (isSelect) {
                db.all(sqliteText, params, (err, rows) => {
                    if (err) return reject(err);
                    resolve({ rows });
                });
            } else {
                db.run(sqliteText, params, function (err) {
                    if (err) return reject(err);
                    resolve({ rows: [], lastID: this.lastID, changes: this.changes });
                });
            }
        });
    },
    pool: db // Export the db instance as 'pool' for any direct access if needed
};
