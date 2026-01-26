const db = require('./server/db');

async function checkLayers() {
    try {
        const result = await db.query('SELECT name, params FROM layers');
        result.rows.forEach(l => {
            console.log(`Layer: ${l.name}`);
            console.log(`Params: ${l.params}`);
            console.log('---');
        });
    } catch (err) {
        console.error(err);
    }
}

checkLayers();
