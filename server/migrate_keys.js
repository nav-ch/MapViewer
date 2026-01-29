const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

const steps = [
    {
        name: 'Add allowed_hosts column',
        sql: 'ALTER TABLE api_keys ADD COLUMN allowed_hosts TEXT'
    },
    {
        name: 'Add expires_at column',
        sql: 'ALTER TABLE api_keys ADD COLUMN expires_at DATETIME'
    }
];

function runMigration() {
    console.log('Starting migration for API Keys Table...');

    let completed = 0;

    steps.forEach(step => {
        db.run(step.sql, (err) => {
            if (err) {
                if (err.message.includes('duplicate column name')) {
                    console.log(`[SKIP] ${step.name}: Column already exists.`);
                } else {
                    console.error(`[ERROR] ${step.name}:`, err.message);
                }
            } else {
                console.log(`[SUCCESS] ${step.name}`);
            }
            completed++;
            if (completed === steps.length) {
                console.log('Migration completed.');
                db.close();
            }
        });
    });
}

runMigration();
