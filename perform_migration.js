const db = require('./server/db');

(async () => {
    console.log('Starting migration...');
    const sqliteDb = db.pool; // Access the underlying sqlite3 db object

    const run = (sql) => new Promise((resolve, reject) => {
        sqliteDb.run(sql, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });

    try {
        try {
            console.log('Adding allowed_hosts column...');
            await run("ALTER TABLE api_keys ADD COLUMN allowed_hosts TEXT");
            console.log('allowed_hosts added.');
        } catch (e) {
            if (e.message.includes('duplicate column name')) {
                console.log('allowed_hosts already exists.');
            } else {
                console.error('Error adding allowed_hosts:', e.message);
            }
        }

        try {
            console.log('Adding expires_at column...');
            await run("ALTER TABLE api_keys ADD COLUMN expires_at DATETIME");
            console.log('expires_at added.');
        } catch (e) {
            if (e.message.includes('duplicate column name')) {
                console.log('expires_at already exists.');
            } else {
                console.error('Error adding expires_at:', e.message);
            }
        }

        console.log('Migration complete.');
    } catch (err) {
        console.error('Migration failed:', err);
    }
})();
