const db = require('./server/db');

async function checkDistricts() {
    try {
        const result = await db.query("SELECT * FROM layers WHERE name = 'Districts'");
        console.log(JSON.stringify(result.rows, null, 2));
    } catch (err) {
        console.error(err);
    }
}

checkDistricts();
