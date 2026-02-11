const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const BaseProvider = require('./BaseProvider');

class SQLiteProvider extends BaseProvider {
    constructor(config) {
        super(config);
        this.dbPath = config.connectionString || path.join(__dirname, '..', '..', '..', 'database.sqlite');
        this.db = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) return reject(err);

                // Enable WAL mode for better concurrency
                this.db.run('PRAGMA journal_mode = WAL', (err) => {
                    if (err) console.warn('Failed to enable WAL mode:', err);
                    resolve();
                });
            });
        });
    }

    parseQuery(text) {
        // Convert PG-style placeholders ($1, $2) to SQLite-style (?)
        return text.replace(/\$\d+/g, '?');
    }

    async query(text, params = []) {
        if (!this.db) await this.connect();

        return new Promise((resolve, reject) => {
            const sqliteText = this.parseQuery(text);
            const isSelect = sqliteText.trim().toUpperCase().startsWith('SELECT') ||
                sqliteText.trim().toUpperCase().startsWith('PRAGMA');

            if (isSelect) {
                this.db.all(sqliteText, params, (err, rows) => {
                    if (err) return reject(err);
                    resolve({ rows, rowCount: rows.length });
                });
            } else {
                this.db.run(sqliteText, params, function (err) {
                    if (err) return reject(err);
                    resolve({ rows: [], rowCount: this.changes, lastID: this.lastID });
                });
            }
        });
    }

    async close() {
        if (this.db) {
            return new Promise((resolve, reject) => {
                this.db.close((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }
    }
}

module.exports = SQLiteProvider;
