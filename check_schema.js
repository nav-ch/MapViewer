const db = require('./server/db');

(async () => {
    try {
        console.log('Checking api_keys schema...');
        const result = await db.query("PRAGMA table_info(api_keys)");
        console.log(result);
    } catch (err) {
        console.error(err);
    }
})();
