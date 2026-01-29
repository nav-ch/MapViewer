const db = require('./db'); // Relative to server dir
const { v4: uuidv4 } = require('uuid');

(async () => {
    try {
        const id = uuidv4();
        const key = uuidv4();
        const testHost = 'test.example.com';

        console.log('Inserting test key...');
        await db.query(
            'INSERT INTO api_keys (id, key, app_name, is_active, allowed_hosts) VALUES (?, ?, ?, ?, ?)',
            [id, key, 'Test AppPersistence', 1, testHost]
        );

        console.log('Fetching test key...');
        const result = await db.query('SELECT * FROM api_keys WHERE id = ?', [id]);

        if (result.rows.length > 0) {
            const row = result.rows[0];
            console.log('Retrieved Row:', row);
            if (row.allowed_hosts === testHost) {
                console.log('SUCCESS: allowed_hosts persisted correctly.');
            } else {
                console.error('FAILURE: allowed_hosts mismatch.', row.allowed_hosts);
            }
        } else {
            console.error('FAILURE: Key not found.');
        }

        console.log('Cleaning up...');
        await db.query('DELETE FROM api_keys WHERE id = ?', [id]);
    } catch (err) {
        console.error('Error:', err);
    }
})();
